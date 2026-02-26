/**
 * Base58 and Base58Check encoding/decoding utilities.
 *
 * Base58Check is used in Bitcoin/BSV for WIF private keys and addresses.
 * Format: version_byte + payload + checksum (first 4 bytes of double-SHA256)
 */

import { sha256 } from '@noble/hashes/sha2';

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/**
 * Encode a byte array to Base58 string.
 */
export function base58Encode(bytes: Uint8Array): string {
  // Count leading zeros
  let leadingZeros = 0;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0) {
      leadingZeros++;
    } else {
      break;
    }
  }

  // Convert bytes to a big integer
  let num = BigInt(0);
  for (let i = 0; i < bytes.length; i++) {
    num = num * BigInt(256) + BigInt(bytes[i]);
  }

  // Convert big integer to Base58
  const chars: string[] = [];
  while (num > BigInt(0)) {
    const remainder = Number(num % BigInt(58));
    num = num / BigInt(58);
    chars.unshift(BASE58_ALPHABET[remainder]);
  }

  // Add leading '1's for each leading zero byte
  for (let i = 0; i < leadingZeros; i++) {
    chars.unshift('1');
  }

  return chars.join('');
}

/**
 * Decode a Base58 string to byte array.
 */
export function base58Decode(str: string): Uint8Array {
  // Count leading '1's
  let leadingOnes = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '1') {
      leadingOnes++;
    } else {
      break;
    }
  }

  // Convert Base58 string to big integer
  let num = BigInt(0);
  for (let i = 0; i < str.length; i++) {
    const index = BASE58_ALPHABET.indexOf(str[i]);
    if (index === -1) {
      throw new Error(`Invalid Base58 character: ${str[i]}`);
    }
    num = num * BigInt(58) + BigInt(index);
  }

  // Convert big integer to bytes
  const bytes: number[] = [];
  while (num > BigInt(0)) {
    bytes.unshift(Number(num % BigInt(256)));
    num = num / BigInt(256);
  }

  // Add leading zero bytes
  for (let i = 0; i < leadingOnes; i++) {
    bytes.unshift(0);
  }

  return new Uint8Array(bytes);
}

/**
 * Compute double-SHA256 checksum (first 4 bytes).
 */
export function checksum(payload: Uint8Array): Uint8Array {
  const hash = sha256(sha256(payload));
  return hash.slice(0, 4);
}

/**
 * Encode payload with Base58Check (version byte + payload + 4-byte checksum).
 */
export function base58CheckEncode(version: number, payload: Uint8Array): string {
  const versionedPayload = new Uint8Array(1 + payload.length);
  versionedPayload[0] = version;
  versionedPayload.set(payload, 1);

  const cs = checksum(versionedPayload);
  const full = new Uint8Array(versionedPayload.length + 4);
  full.set(versionedPayload);
  full.set(cs, versionedPayload.length);

  return base58Encode(full);
}

/**
 * Decode a Base58Check string. Returns { version, payload }.
 */
export function base58CheckDecode(str: string): { version: number; payload: Uint8Array } {
  const bytes = base58Decode(str);
  if (bytes.length < 5) {
    throw new Error('Base58Check string too short');
  }

  const payload = bytes.slice(0, bytes.length - 4);
  const expectedChecksum = bytes.slice(bytes.length - 4);
  const actualChecksum = checksum(payload);

  for (let i = 0; i < 4; i++) {
    if (expectedChecksum[i] !== actualChecksum[i]) {
      throw new Error('Base58Check checksum mismatch');
    }
  }

  return {
    version: payload[0],
    payload: payload.slice(1),
  };
}
