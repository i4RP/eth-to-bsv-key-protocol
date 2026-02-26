"""
HPKE (Hybrid Public Key Encryption) for Privy wallet export.

Uses pyhpke library (RFC 9180) with:
- KEM: DHKEM(P-256, HKDF-SHA256)
- KDF: HKDF-SHA256
- AEAD: ChaCha20-Poly1305
"""

import os
import base64

from pyhpke import CipherSuite, KEMId, KDFId, AEADId
from cryptography.hazmat.primitives import serialization


def _get_suite() -> CipherSuite:
    """Get the HPKE cipher suite matching Privy's configuration."""
    return CipherSuite.new(
        KEMId.DHKEM_P256_HKDF_SHA256,
        KDFId.HKDF_SHA256,
        AEADId.CHACHA20_POLY1305,
    )


class HPKERecipient:
    """HPKE recipient for decrypting Privy wallet export responses."""

    def __init__(self):
        """Generate a new P-256 key pair for HPKE using pyhpke."""
        self._suite = _get_suite()
        ikm = os.urandom(32)
        keypair = self._suite.kem.derive_key_pair(ikm)
        self._public_key = keypair.public_key
        self._private_key = keypair.private_key

    def get_public_key_spki_base64(self) -> str:
        """Get the public key in SPKI/DER format, base64-encoded (for Privy API)."""
        # Access the underlying cryptography key via .raw
        spki_bytes = self._public_key.raw.public_bytes(
            encoding=serialization.Encoding.DER,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        return base64.b64encode(spki_bytes).decode("ascii")

    def decrypt(self, encapsulated_key_b64: str, ciphertext_b64: str) -> bytes:
        """
        Decrypt an HPKE-encrypted payload from Privy.

        Args:
            encapsulated_key_b64: Base64-encoded encapsulated key (sender's ephemeral public key)
            ciphertext_b64: Base64-encoded ciphertext

        Returns:
            Decrypted plaintext bytes
        """
        enc = base64.b64decode(encapsulated_key_b64)
        ciphertext = base64.b64decode(ciphertext_b64)

        # Create recipient context and decrypt
        ctx = self._suite.create_recipient_context(enc, self._private_key)
        plaintext = ctx.open(ciphertext)

        return plaintext
