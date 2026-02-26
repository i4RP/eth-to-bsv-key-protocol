/**
 * Browser-compatible ETH-to-BSV key conversion logic.
 * Uses @noble/secp256k1, @noble/hashes, and hash.js (for RIPEMD-160).
 */

import { getPublicKey, etc } from '@noble/secp256k1';
import { sha256 } from '@noble/hashes/sha2.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const hashjs = require('hash.js');

// ============ Types ============

export interface ConversionResult {
  ethPrivateKey: string;
  ethAddress: string;
  bsvPrivateKeyWIF: string;
  bsvAddress: string;
  compressedPublicKey: string;
  uncompressedPublicKey: string;
  network: 'mainnet' | 'testnet';
}

// ============ Base58 Encoding ============

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Encode(bytes: Uint8Array): string {
  let leadingZeros = 0;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0) leadingZeros++;
    else break;
  }
  let num = BigInt(0);
  for (let i = 0; i < bytes.length; i++) {
    num = num * BigInt(256) + BigInt(bytes[i]);
  }
  const chars: string[] = [];
  while (num > BigInt(0)) {
    chars.unshift(BASE58_ALPHABET[Number(num % BigInt(58))]);
    num = num / BigInt(58);
  }
  for (let i = 0; i < leadingZeros; i++) chars.unshift('1');
  return chars.join('');
}

function doubleSha256Checksum(payload: Uint8Array): Uint8Array {
  return sha256(sha256(payload)).slice(0, 4);
}

function base58CheckEncode(version: number, payload: Uint8Array): string {
  const versioned = new Uint8Array(1 + payload.length);
  versioned[0] = version;
  versioned.set(payload, 1);
  const cs = doubleSha256Checksum(versioned);
  const full = new Uint8Array(versioned.length + 4);
  full.set(versioned);
  full.set(cs, versioned.length);
  return base58Encode(full);
}

// ============ RIPEMD-160 (browser-compatible via hash.js) ============

function ripemd160(data: Uint8Array): Uint8Array {
  const hash = hashjs.ripemd160().update(Array.from(data)).digest();
  return new Uint8Array(hash);
}

function hash160(data: Uint8Array): Uint8Array {
  return ripemd160(sha256(data));
}

// ============ Key Normalization ============

function normalizeHexKey(hex: string): string {
  let cleaned = hex.trim();
  if (cleaned.startsWith('0x') || cleaned.startsWith('0X')) cleaned = cleaned.slice(2);
  if (!/^[0-9a-fA-F]+$/.test(cleaned)) throw new Error('無効な16進文字が含まれています');
  if (cleaned.length < 64) cleaned = cleaned.padStart(64, '0');
  if (cleaned.length !== 64) throw new Error(`秘密鍵の長さが無効です: ${cleaned.length}文字 (64文字必要)`);

  const keyBigInt = BigInt('0x' + cleaned);
  const n = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
  if (keyBigInt === BigInt(0)) throw new Error('秘密鍵はゼロにできません');
  if (keyBigInt >= n) throw new Error('秘密鍵がsecp256k1曲線の次数を超えています');

  return cleaned.toLowerCase();
}

// ============ Address Derivation ============

function toChecksumAddress(address: string): string {
  const lower = address.toLowerCase();
  const hashHex = etc.bytesToHex(keccak_256(new TextEncoder().encode(lower)));
  let checksummed = '0x';
  for (let i = 0; i < lower.length; i++) {
    const char = lower[i];
    if (/[a-f]/.test(char)) {
      checksummed += parseInt(hashHex[i], 16) >= 8 ? char.toUpperCase() : char;
    } else {
      checksummed += char;
    }
  }
  return checksummed;
}

// ============ Main Conversion ============

export function convertEthToBSV(
  ethPrivateKey: string,
  network: 'mainnet' | 'testnet' = 'mainnet'
): ConversionResult {
  const normalizedHex = normalizeHexKey(ethPrivateKey);
  const privateKeyBytes = etc.hexToBytes(normalizedHex);

  // Derive public keys
  const compressedPubKey = getPublicKey(privateKeyBytes, true);
  const uncompressedPubKey = getPublicKey(privateKeyBytes, false);

  // BSV WIF encoding
  const wifVersion = network === 'mainnet' ? 0x80 : 0xef;
  const wifPayload = new Uint8Array(privateKeyBytes.length + 1);
  wifPayload.set(privateKeyBytes);
  wifPayload[privateKeyBytes.length] = 0x01; // compression flag
  const bsvWIF = base58CheckEncode(wifVersion, wifPayload);

  // BSV P2PKH address
  const addrVersion = network === 'mainnet' ? 0x00 : 0x6f;
  const pubKeyHash = hash160(compressedPubKey);
  const bsvAddress = base58CheckEncode(addrVersion, pubKeyHash);

  // ETH address
  const pubKeyBody = uncompressedPubKey.slice(1);
  const ethHash = keccak_256(pubKeyBody);
  const addressBytes = ethHash.slice(12);
  const ethAddress = toChecksumAddress(etc.bytesToHex(addressBytes));

  return {
    ethPrivateKey: normalizedHex,
    ethAddress,
    bsvPrivateKeyWIF: bsvWIF,
    bsvAddress,
    compressedPublicKey: etc.bytesToHex(compressedPubKey),
    uncompressedPublicKey: etc.bytesToHex(uncompressedPubKey),
    network,
  };
}
