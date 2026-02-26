import os
import base64
import hashlib

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from app.hpke import HPKERecipient
from app.auth import AuthorizationKey

load_dotenv()

app = FastAPI()

# Disable CORS. Do not remove this for full-stack development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

PRIVY_APP_ID = os.getenv("PRIVY_APP_ID", "")
PRIVY_APP_SECRET = os.getenv("PRIVY_APP_SECRET", "")
PRIVY_BASE_URL = "https://api.privy.io"


def _privy_auth_header() -> str:
    credentials = f"{PRIVY_APP_ID}:{PRIVY_APP_SECRET}"
    encoded = base64.b64encode(credentials.encode()).decode()
    return f"Basic {encoded}"


def _privy_headers() -> dict[str, str]:
    return {
        "Authorization": _privy_auth_header(),
        "privy-app-id": PRIVY_APP_ID,
        "Content-Type": "application/json",
    }


# ============ ETH-to-BSV Conversion ============

BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"


def _base58_encode(data: bytes) -> str:
    leading_zeros = sum(1 for b in data if b == 0)
    num = int.from_bytes(data, "big")
    chars = []
    while num > 0:
        num, remainder = divmod(num, 58)
        chars.append(BASE58_ALPHABET[remainder])
    return "1" * leading_zeros + "".join(reversed(chars))


def _base58check_encode(version: int, payload: bytes) -> str:
    versioned = bytes([version]) + payload
    checksum = hashlib.sha256(hashlib.sha256(versioned).digest()).digest()[:4]
    return _base58_encode(versioned + checksum)


def _hash160(data: bytes) -> bytes:
    from Crypto.Hash import RIPEMD160
    sha = hashlib.sha256(data).digest()
    return RIPEMD160.new(sha).digest()


def _eth_to_bsv(private_key_hex: str, network: str = "mainnet") -> dict:
    from Crypto.Hash import keccak as keccak_mod
    from cryptography.hazmat.primitives.asymmetric import ec as ec_mod
    from cryptography.hazmat.primitives import serialization as ser_mod

    cleaned = private_key_hex.strip()
    if cleaned.startswith("0x") or cleaned.startswith("0X"):
        cleaned = cleaned[2:]
    cleaned = cleaned.lower().zfill(64)
    if len(cleaned) != 64:
        raise ValueError(f"Invalid private key length: {len(cleaned)}")

    pk_bytes = bytes.fromhex(cleaned)
    pk_int = int.from_bytes(pk_bytes, "big")
    n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
    if pk_int == 0 or pk_int >= n:
        raise ValueError("Private key out of valid range")

    private_key = ec_mod.derive_private_key(pk_int, ec_mod.SECP256K1())
    public_key = private_key.public_key()
    compressed_pub = public_key.public_bytes(
        encoding=ser_mod.Encoding.X962, format=ser_mod.PublicFormat.CompressedPoint
    )
    uncompressed_pub = public_key.public_bytes(
        encoding=ser_mod.Encoding.X962, format=ser_mod.PublicFormat.UncompressedPoint
    )

    wif_version = 0x80 if network == "mainnet" else 0xEF
    bsv_wif = _base58check_encode(wif_version, pk_bytes + b"\x01")

    addr_version = 0x00 if network == "mainnet" else 0x6F
    bsv_address = _base58check_encode(addr_version, _hash160(compressed_pub))

    keccak = keccak_mod.new(digest_bits=256)
    keccak.update(uncompressed_pub[1:])
    eth_addr_raw = keccak.hexdigest()[-40:]

    keccak2 = keccak_mod.new(digest_bits=256)
    keccak2.update(eth_addr_raw.encode())
    checksum_hash = keccak2.hexdigest()
    eth_address = "0x"
    for i, c in enumerate(eth_addr_raw):
        if c in "abcdef":
            eth_address += c.upper() if int(checksum_hash[i], 16) >= 8 else c
        else:
            eth_address += c

    return {
        "ethPrivateKey": cleaned,
        "ethAddress": eth_address,
        "bsvPrivateKeyWIF": bsv_wif,
        "bsvAddress": bsv_address,
        "compressedPublicKey": compressed_pub.hex(),
        "uncompressedPublicKey": uncompressed_pub.hex(),
        "network": network,
    }


# ============ API Models ============

class ConvertRequest(BaseModel):
    ethPrivateKey: str
    network: str = "mainnet"


class CreateWalletRequest(BaseModel):
    network: str = "mainnet"


class ExportWalletRequest(BaseModel):
    walletId: str
    network: str = "mainnet"


# ============ Endpoints ============

@app.get("/healthz")
async def healthz():
    return {"status": "ok"}


@app.post("/api/convert")
async def convert_key(req: ConvertRequest):
    try:
        return _eth_to_bsv(req.ethPrivateKey, req.network)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/wallets/create")
async def create_wallet(req: CreateWalletRequest):
    if not PRIVY_APP_ID or not PRIVY_APP_SECRET:
        raise HTTPException(status_code=500, detail="Privy credentials not configured")

    async with httpx.AsyncClient(timeout=30.0) as client:
        # Generate an authorization key pair for wallet ownership
        auth_key = AuthorizationKey()
        auth_pub_key_b64 = auth_key.get_public_key_base64_der()

        # Create wallet with authorization key as owner
        create_body = {
            "chain_type": "ethereum",
            "owner": {"public_key": auth_pub_key_b64},
        }
        create_resp = await client.post(
            f"{PRIVY_BASE_URL}/v1/wallets",
            headers=_privy_headers(),
            json=create_body,
        )
        if create_resp.status_code not in (200, 201):
            raise HTTPException(
                status_code=create_resp.status_code,
                detail=f"Privy wallet creation failed: {create_resp.text}",
            )
        wallet_data = create_resp.json()
        wallet_id = wallet_data["id"]
        wallet_address = wallet_data["address"]

        # Export wallet private key using HPKE
        hpke_recipient = HPKERecipient()
        hpke_pub_key_b64 = hpke_recipient.get_public_key_spki_base64()

        export_path = f"/v1/wallets/{wallet_id}/export"
        export_full_url = f"{PRIVY_BASE_URL}{export_path}"
        export_body = {
            "encryption_type": "HPKE",
            "recipient_public_key": hpke_pub_key_b64,
        }
        auth_signature = auth_key.sign_request(
            "POST", export_full_url, export_body, PRIVY_APP_ID
        )

        export_headers = {**_privy_headers(), "privy-authorization-signature": auth_signature}
        export_resp = await client.post(
            export_full_url,
            headers=export_headers,
            json=export_body,
        )
        if export_resp.status_code != 200:
            raise HTTPException(
                status_code=export_resp.status_code,
                detail=f"Privy wallet export failed: {export_resp.text}",
            )
        export_data = export_resp.json()
        private_key_bytes = hpke_recipient.decrypt(
            export_data["encapsulated_key"],
            export_data["ciphertext"],
        )
        private_key_hex = private_key_bytes.decode("utf-8")

        conversion = _eth_to_bsv(private_key_hex, req.network)
        return {
            "privyWalletId": wallet_id,
            "privyWalletAddress": wallet_address,
            "conversion": conversion,
        }


@app.post("/api/wallets/export")
async def export_wallet(req: ExportWalletRequest):
    """Export an existing Privy wallet. Note: requires the wallet's authorization key.
    For wallets created via /api/wallets/create, the auth key is ephemeral and not stored,
    so this endpoint only works for wallets without an owner or with externally managed keys."""
    if not PRIVY_APP_ID or not PRIVY_APP_SECRET:
        raise HTTPException(status_code=500, detail="Privy credentials not configured")

    async with httpx.AsyncClient(timeout=30.0) as client:
        hpke_recipient = HPKERecipient()
        hpke_pub_key_b64 = hpke_recipient.get_public_key_spki_base64()

        export_url = f"/v1/wallets/{req.walletId}/export"
        export_body = {
            "encryption_type": "HPKE",
            "recipient_public_key": hpke_pub_key_b64,
        }

        export_resp = await client.post(
            f"{PRIVY_BASE_URL}{export_url}",
            headers=_privy_headers(),
            json=export_body,
        )
        if export_resp.status_code != 200:
            raise HTTPException(
                status_code=export_resp.status_code,
                detail=f"Privy wallet export failed: {export_resp.text}",
            )
        export_data = export_resp.json()
        private_key_bytes = hpke_recipient.decrypt(
            export_data["encapsulated_key"],
            export_data["ciphertext"],
        )
        private_key_hex = private_key_bytes.decode("utf-8")
        return _eth_to_bsv(private_key_hex, req.network)
