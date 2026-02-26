/**
 * Cryptographic utilities for key conversion.
 *
 * Uses @noble/secp256k1 for elliptic curve operations,
 * @noble/hashes for SHA-256 and Keccak-256,
 * and Node.js crypto for RIPEMD-160.
 */

import { getPublicKey, etc } from '@noble/secp256k1';
import { sha256 } from '@noble/hashes/sha2';
import { keccak_256 } from '@noble/hashes/sha3';
import { createHash } from 'crypto';
import type { RawPrivateKey, HexPrivateKey } from './types';

/**
 * Validate and normalize a hex private key string.
 * Removes 0x prefix, validates length and hex characters.
 * Validates the key is within the valid range for secp256k1.
 */
export function normalizeHexKey(hex: HexPrivateKey): string {
  let cleaned = hex.trim();

  // Remove 0x prefix
  if (cleaned.startsWith('0x') || cleaned.startsWith('0X')) {
    cleaned = cleaned.slice(2);
  }

  // Validate hex characters
  if (!/^[0-9a-fA-F]+$/.test(cleaned)) {
    throw new Error('Invalid hex characters in private key');
  }

  // Pad to 64 characters if needed (left-pad with zeros)
  if (cleaned.length < 64) {
    cleaned = cleaned.padStart(64, '0');
  }

  if (cleaned.length !== 64) {
    throw new Error(`Invalid private key length: expected 64 hex chars (32 bytes), got ${cleaned.length}`);
  }

  // Validate key is within secp256k1 valid range (1 <= key < n)
  const keyBigInt = BigInt('0x' + cleaned);
  const secp256k1N = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');

  if (keyBigInt === BigInt(0)) {
    throw new Error('Private key cannot be zero');
  }

  if (keyBigInt >= secp256k1N) {
    throw new Error('Private key exceeds secp256k1 curve order');
  }

  return cleaned.toLowerCase();
}

/**
 * Convert a hex string to Uint8Array.
 */
export function hexToBytes(hex: string): RawPrivateKey {
  return etc.hexToBytes(hex);
}

/**
 * Convert a Uint8Array to hex string.
 */
export function bytesToHex(bytes: Uint8Array): string {
  return etc.bytesToHex(bytes);
}

/**
 * Derive compressed public key (33 bytes) from a raw private key.
 */
export function deriveCompressedPublicKey(privateKeyBytes: RawPrivateKey): Uint8Array {
  return getPublicKey(privateKeyBytes, true);
}

/**
 * Derive uncompressed public key (65 bytes) from a raw private key.
 */
export function deriveUncompressedPublicKey(privateKeyBytes: RawPrivateKey): Uint8Array {
  return getPublicKey(privateKeyBytes, false);
}

/**
 * Compute SHA-256 hash.
 */
export function hashSHA256(data: Uint8Array): Uint8Array {
  return sha256(data);
}

/**
 * Compute RIPEMD-160 hash using Node.js crypto.
 */
export function hashRIPEMD160(data: Uint8Array): Uint8Array {
  const hash = createHash('ripemd160');
  hash.update(data);
  return new Uint8Array(hash.digest());
}

/**
 * Compute Hash160 = RIPEMD160(SHA256(data)).
 * Used in Bitcoin/BSV for address derivation.
 */
export function hash160(data: Uint8Array): Uint8Array {
  return hashRIPEMD160(hashSHA256(data));
}

/**
 * Compute Keccak-256 hash.
 * Used in Ethereum for address derivation.
 */
export function hashKeccak256(data: Uint8Array): Uint8Array {
  return keccak_256(data);
}
