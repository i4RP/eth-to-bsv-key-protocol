"""
Privy Authorization Key Management and Request Signing.

Generates P-256 key pairs for wallet ownership and signs API requests
per the Privy authorization signature protocol.
"""

import json
import hashlib
import base64

from cryptography.hazmat.primitives.asymmetric import ec, utils
from cryptography.hazmat.primitives import serialization, hashes


class AuthorizationKey:
    """Manages a P-256 authorization key pair for Privy wallet ownership."""

    def __init__(self):
        """Generate a fresh P-256 key pair."""
        self._private_key = ec.generate_private_key(ec.SECP256R1())
        self._public_key = self._private_key.public_key()

    def get_public_key_base64_der(self) -> str:
        """Get the public key in SPKI/DER format, base64-encoded (for Privy API owner field)."""
        spki_bytes = self._public_key.public_bytes(
            encoding=serialization.Encoding.DER,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        return base64.b64encode(spki_bytes).decode("ascii")

    def sign_request(
        self,
        method: str,
        url: str,
        body: dict | str,
        privy_app_id: str,
    ) -> str:
        """
        Sign a Privy API request for authorization.

        Per Privy docs (direct-implementation):
        Payload: { version: 1, method, url (full), body, headers: { privy-app-id } }
        Then: RFC 8785 canonicalize -> SHA-256 -> ECDSA P-256 sign -> base64(DER)

        Args:
            method: HTTP method (e.g., "POST")
            url: Full URL (e.g., "https://api.privy.io/v1/wallets/{id}/export")
            body: Request body dict or empty string
            privy_app_id: The Privy app ID

        Returns:
            Base64-encoded DER authorization signature
        """
        payload = {
            "version": 1,
            "method": method,
            "url": url,
            "body": body if body else "",
            "headers": {
                "privy-app-id": privy_app_id,
            },
        }
        # RFC 8785 canonicalize (sorted keys, compact JSON)
        canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
        payload_bytes = canonical.encode("utf-8")

        # SHA-256 hash
        digest = hashlib.sha256(payload_bytes).digest()

        # Sign with ECDSA P-256 (prehashed)
        signature_der = self._private_key.sign(
            digest,
            ec.ECDSA(utils.Prehashed(hashes.SHA256())),
        )

        return base64.b64encode(signature_der).decode("ascii")
