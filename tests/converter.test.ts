/**
 * Tests for ETH-to-BSV key conversion protocol.
 *
 * Test vectors are derived from well-known Ethereum private keys
 * (e.g., Hardhat default accounts) and verified against independent tools.
 */

import {
  convertEthToBSV,
  privateKeyToWIF,
  publicKeyToBSVAddress,
  publicKeyToEthAddress,
} from '../src/converter';
import {
  normalizeHexKey,
  hexToBytes,
  bytesToHex,
  hash160,
  deriveCompressedPublicKey,
  deriveUncompressedPublicKey,
} from '../src/crypto';
import {
  base58Encode,
  base58Decode,
  base58CheckEncode,
  base58CheckDecode,
} from '../src/encoding';
import { Network } from '../src/types';

describe('normalizeHexKey', () => {
  test('should strip 0x prefix', () => {
    const key = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    expect(normalizeHexKey(key)).toBe('ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
  });

  test('should accept key without 0x prefix', () => {
    const key = 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    expect(normalizeHexKey(key)).toBe('ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
  });

  test('should lowercase the hex string', () => {
    const key = 'AC0974BEC39A17E36BA4A6B4D238FF944BACB478CBED5EFCAE784D7BF4F2FF80';
    expect(normalizeHexKey(key)).toBe('ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
  });

  test('should pad short keys with leading zeros', () => {
    const key = '1';
    expect(normalizeHexKey(key)).toBe('0000000000000000000000000000000000000000000000000000000000000001');
  });

  test('should reject invalid hex characters', () => {
    expect(() => normalizeHexKey('xyz123')).toThrow('Invalid hex characters');
  });

  test('should reject too-long keys', () => {
    const key = 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff8000';
    expect(() => normalizeHexKey(key)).toThrow('Invalid private key length');
  });

  test('should reject zero key', () => {
    expect(() => normalizeHexKey('0')).toThrow('Private key cannot be zero');
  });

  test('should reject key >= curve order', () => {
    // secp256k1 order n
    expect(() => normalizeHexKey('FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141'))
      .toThrow('exceeds secp256k1 curve order');
  });

  test('should accept key = n - 1 (max valid)', () => {
    const maxKey = 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364140';
    expect(normalizeHexKey(maxKey)).toBe('fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364140');
  });
});

describe('Base58 encoding', () => {
  test('should encode and decode correctly', () => {
    const bytes = new Uint8Array([0, 1, 2, 3, 4, 5]);
    const encoded = base58Encode(bytes);
    const decoded = base58Decode(encoded);
    expect(Array.from(decoded)).toEqual(Array.from(bytes));
  });

  test('should handle leading zeros', () => {
    const bytes = new Uint8Array([0, 0, 0, 1]);
    const encoded = base58Encode(bytes);
    expect(encoded.startsWith('111')).toBe(true);
    const decoded = base58Decode(encoded);
    expect(Array.from(decoded)).toEqual(Array.from(bytes));
  });

  test('should encode empty array', () => {
    const bytes = new Uint8Array([]);
    const encoded = base58Encode(bytes);
    expect(encoded).toBe('');
  });
});

describe('Base58Check encoding', () => {
  test('should encode and decode with checksum', () => {
    const version = 0x80;
    const payload = new Uint8Array(32).fill(0x42);
    const encoded = base58CheckEncode(version, payload);
    const decoded = base58CheckDecode(encoded);
    expect(decoded.version).toBe(version);
    expect(Array.from(decoded.payload)).toEqual(Array.from(payload));
  });

  test('should detect checksum errors', () => {
    const version = 0x00;
    const payload = new Uint8Array(20).fill(0xAB);
    const encoded = base58CheckEncode(version, payload);
    // Corrupt the last character
    const corrupted = encoded.slice(0, -1) + (encoded.endsWith('1') ? '2' : '1');
    expect(() => base58CheckDecode(corrupted)).toThrow('checksum mismatch');
  });
});

describe('Crypto utilities', () => {
  test('hexToBytes and bytesToHex roundtrip', () => {
    const hex = 'deadbeef01020304';
    const bytes = hexToBytes(hex);
    expect(bytesToHex(bytes)).toBe(hex);
  });

  test('hash160 produces 20-byte output', () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const result = hash160(data);
    expect(result.length).toBe(20);
  });

  test('deriveCompressedPublicKey produces 33-byte output', () => {
    const key = hexToBytes('0000000000000000000000000000000000000000000000000000000000000001');
    const pub = deriveCompressedPublicKey(key);
    expect(pub.length).toBe(33);
    // First byte should be 02 or 03
    expect(pub[0] === 0x02 || pub[0] === 0x03).toBe(true);
  });

  test('deriveUncompressedPublicKey produces 65-byte output', () => {
    const key = hexToBytes('0000000000000000000000000000000000000000000000000000000000000001');
    const pub = deriveUncompressedPublicKey(key);
    expect(pub.length).toBe(65);
    expect(pub[0]).toBe(0x04);
  });
});

describe('WIF encoding', () => {
  // Well-known test vector: private key = 1
  test('should encode private key 1 correctly for mainnet', () => {
    const keyBytes = hexToBytes('0000000000000000000000000000000000000000000000000000000000000001');
    const wif = privateKeyToWIF(keyBytes, Network.Mainnet);
    // WIF for compressed key "1" on mainnet
    expect(wif).toBe('KwDiBf89QgGbjEhKnhXJuH7LrciVrZi3qYjgd9M7rFU73sVHnoWn');
  });

  test('should encode private key 1 correctly for testnet', () => {
    const keyBytes = hexToBytes('0000000000000000000000000000000000000000000000000000000000000001');
    const wif = privateKeyToWIF(keyBytes, Network.Testnet);
    // WIF for compressed key "1" on testnet
    expect(wif).toBe('cMahea7zqjxrtgAbB7LSGbcQUr1uX1ojuat9jZodMN87JcbXMTcA');
  });
});

describe('BSV address derivation', () => {
  test('should derive correct BSV address for private key 1', () => {
    const keyBytes = hexToBytes('0000000000000000000000000000000000000000000000000000000000000001');
    const compressedPub = deriveCompressedPublicKey(keyBytes);
    const address = publicKeyToBSVAddress(compressedPub, Network.Mainnet);
    // Known BSV/BTC address for compressed public key from private key 1
    expect(address).toBe('1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH');
  });
});

describe('ETH address derivation', () => {
  test('should derive correct ETH address for private key 1', () => {
    const keyBytes = hexToBytes('0000000000000000000000000000000000000000000000000000000000000001');
    const uncompressedPub = deriveUncompressedPublicKey(keyBytes);
    const address = publicKeyToEthAddress(uncompressedPub);
    // Known ETH address for private key 1
    expect(address.toLowerCase()).toBe('0x7e5f4552091a69125d5dfcb7b8c2659029395bdf');
  });
});

describe('Full conversion: convertEthToBSV', () => {
  test('should convert Hardhat account #0', () => {
    const ethKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    const result = convertEthToBSV(ethKey);

    expect(result.ethPrivateKey).toBe('ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
    expect(result.ethAddress.toLowerCase()).toBe('0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266');
    expect(result.network).toBe(Network.Mainnet);

    // BSV WIF should start with 'K' or 'L' for compressed mainnet
    expect(result.bsvPrivateKeyWIF[0] === 'K' || result.bsvPrivateKeyWIF[0] === 'L').toBe(true);

    // BSV address should start with '1' for mainnet P2PKH
    expect(result.bsvAddress.startsWith('1')).toBe(true);

    // Compressed public key should be 66 hex chars (33 bytes)
    expect(result.compressedPublicKey.length).toBe(66);

    // Uncompressed public key should be 130 hex chars (65 bytes)
    expect(result.uncompressedPublicKey.length).toBe(130);
  });

  test('should convert with testnet option', () => {
    const ethKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    const result = convertEthToBSV(ethKey, { network: Network.Testnet });

    expect(result.network).toBe(Network.Testnet);
    // Testnet WIF starts with 'c'
    expect(result.bsvPrivateKeyWIF.startsWith('c')).toBe(true);
    // Testnet address starts with 'm' or 'n'
    expect(result.bsvAddress[0] === 'm' || result.bsvAddress[0] === 'n').toBe(true);
  });

  test('should produce deterministic results', () => {
    const ethKey = '59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
    const result1 = convertEthToBSV(ethKey);
    const result2 = convertEthToBSV(ethKey);

    expect(result1.bsvPrivateKeyWIF).toBe(result2.bsvPrivateKeyWIF);
    expect(result1.bsvAddress).toBe(result2.bsvAddress);
    expect(result1.ethAddress).toBe(result2.ethAddress);
  });

  test('should convert private key 1 with known values', () => {
    const result = convertEthToBSV('1');

    expect(result.ethPrivateKey).toBe('0000000000000000000000000000000000000000000000000000000000000001');
    expect(result.bsvPrivateKeyWIF).toBe('KwDiBf89QgGbjEhKnhXJuH7LrciVrZi3qYjgd9M7rFU73sVHnoWn');
    expect(result.bsvAddress).toBe('1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH');
    expect(result.ethAddress.toLowerCase()).toBe('0x7e5f4552091a69125d5dfcb7b8c2659029395bdf');
  });

  test('should reject invalid private keys', () => {
    expect(() => convertEthToBSV('')).toThrow();
    expect(() => convertEthToBSV('0x0')).toThrow('Private key cannot be zero');
    expect(() => convertEthToBSV('not-a-hex')).toThrow('Invalid hex characters');
  });
});
