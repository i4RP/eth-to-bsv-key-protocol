/**
 * Browser-compatible ETH-to-BSV key conversion logic.
 * Uses @noble/secp256k1 and @noble/hashes.
 * RIPEMD-160 is implemented in pure JS for browser compatibility.
 */

import { getPublicKey, etc } from '@noble/secp256k1';
import { sha256 } from '@noble/hashes/sha2.js';
import { keccak_256 } from '@noble/hashes/sha3.js';

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

// ============ RIPEMD-160 (pure JS, browser-compatible) ============

function ripemd160(message: Uint8Array): Uint8Array {
  const K1 = [0x00000000, 0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xa953fd4e];
  const K2 = [0x50a28be6, 0x5c4dd124, 0x6d703ef3, 0x7a6d76e9, 0x00000000];
  const R1 = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,7,4,13,1,10,6,15,3,12,0,9,5,2,14,11,8,3,10,14,4,9,15,8,1,2,7,0,6,13,11,5,12,1,9,11,10,0,8,12,4,13,3,7,15,14,5,6,2,4,0,5,9,7,12,2,10,14,1,3,8,11,6,15,13];
  const R2 = [5,14,7,0,9,2,11,4,13,6,15,8,1,10,3,12,6,11,3,7,0,13,5,10,14,15,8,12,4,9,1,2,15,5,1,3,7,14,6,9,11,8,12,2,10,0,4,13,8,6,4,1,3,11,15,0,5,12,2,13,9,7,10,14,12,15,10,4,1,5,8,7,6,2,13,14,0,3,9,11];
  const S1 = [11,14,15,12,5,8,7,9,11,13,14,15,6,7,9,8,7,6,8,13,11,9,7,15,7,12,15,9,11,7,13,12,11,13,6,7,14,9,13,15,14,8,13,6,5,12,7,5,11,12,14,15,14,15,9,8,9,14,5,6,8,6,5,12,9,15,5,11,6,8,13,12,5,12,13,14,11,8,5,6];
  const S2 = [8,9,9,11,13,15,15,5,7,7,8,11,14,14,12,6,9,13,15,7,12,8,9,11,7,7,12,7,6,15,13,11,9,7,15,11,8,6,6,14,12,13,5,14,13,13,7,5,15,5,8,11,14,14,6,14,6,9,12,9,12,5,15,8,8,5,12,9,12,5,14,6,8,13,6,5,15,13,11,11];

  function f(j: number, x: number, y: number, z: number): number {
    if (j < 16) return x ^ y ^ z;
    if (j < 32) return (x & y) | (~x & z);
    if (j < 48) return (x | ~y) ^ z;
    if (j < 64) return (x & z) | (y & ~z);
    return x ^ (y | ~z);
  }

  function rotl(x: number, n: number): number {
    return ((x << n) | (x >>> (32 - n))) >>> 0;
  }

  // Padding
  const bitLen = message.length * 8;
  const padLen = (message.length % 64 < 56) ? 56 - (message.length % 64) : 120 - (message.length % 64);
  const padded = new Uint8Array(message.length + padLen + 8);
  padded.set(message);
  padded[message.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, bitLen >>> 0, true);
  view.setUint32(padded.length - 4, Math.floor(bitLen / 0x100000000) >>> 0, true);

  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;

  for (let offset = 0; offset < padded.length; offset += 64) {
    const X = new Array<number>(16);
    for (let i = 0; i < 16; i++) {
      X[i] = view.getUint32(offset + i * 4, true);
    }

    let al = h0, bl = h1, cl = h2, dl = h3, el = h4;
    let ar = h0, br = h1, cr = h2, dr = h3, er = h4;

    for (let j = 0; j < 80; j++) {
      const jd = Math.floor(j / 16);
      let t = (al + f(j, bl, cl, dl) + X[R1[j]] + K1[jd]) >>> 0;
      t = (rotl(t, S1[j]) + el) >>> 0;
      al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;

      t = (ar + f(79 - j, br, cr, dr) + X[R2[j]] + K2[jd]) >>> 0;
      t = (rotl(t, S2[j]) + er) >>> 0;
      ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    }

    const t = (h1 + cl + dr) >>> 0;
    h1 = (h2 + dl + er) >>> 0;
    h2 = (h3 + el + ar) >>> 0;
    h3 = (h4 + al + br) >>> 0;
    h4 = (h0 + bl + cr) >>> 0;
    h0 = t;
  }

  const out = new Uint8Array(20);
  const ov = new DataView(out.buffer);
  ov.setUint32(0, h0, true);
  ov.setUint32(4, h1, true);
  ov.setUint32(8, h2, true);
  ov.setUint32(12, h3, true);
  ov.setUint32(16, h4, true);
  return out;
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
