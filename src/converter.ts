/**
 * Core conversion logic: Ethereum private key → Bitcoin SV private key.
 *
 * Protocol Overview:
 * ==================
 * Both Ethereum and Bitcoin SV use the secp256k1 elliptic curve for their
 * public-key cryptography. This means the raw 32-byte private key is
 * mathematically identical on both chains. The differences are:
 *
 * 1. Key Encoding:
 *    - Ethereum: 32-byte hex string (often 0x-prefixed)
 *    - BSV: WIF (Wallet Import Format) = Base58Check(0x80 + key + 0x01)
 *
 * 2. Address Derivation:
 *    - Ethereum: Keccak256(uncompressed_pubkey[1:])[-20:]
 *    - BSV: Base58Check(0x00 + RIPEMD160(SHA256(compressed_pubkey)))
 *
 * 3. Public Key Format:
 *    - Ethereum: uses uncompressed 65-byte public key (04 + x + y)
 *    - BSV: typically uses compressed 33-byte public key (02/03 + x)
 *
 * Conversion Steps:
 * =================
 * 1. Parse and validate the Ethereum hex private key
 * 2. The raw 32 bytes ARE the BSV private key (same curve)
 * 3. Encode as WIF: Base58Check(version_byte + key_bytes + compression_flag)
 * 4. Derive BSV address: Base58Check(0x00 + Hash160(compressed_pubkey))
 * 5. Derive ETH address for cross-verification
 */

import {
  normalizeHexKey,
  hexToBytes,
  bytesToHex,
  deriveCompressedPublicKey,
  deriveUncompressedPublicKey,
  hash160,
  hashKeccak256,
} from './crypto';
import { base58CheckEncode } from './encoding';
import {
  Network,
  WIF_VERSION,
  P2PKH_VERSION,
  type ConversionResult,
  type ConversionOptions,
  type HexPrivateKey,
} from './types';

/**
 * Encode a raw private key as WIF (Wallet Import Format) for BSV.
 *
 * WIF format for compressed keys:
 *   Base58Check(version_byte + 32_byte_key + 0x01)
 *
 * @param privateKeyBytes - Raw 32-byte private key
 * @param network - Target network (mainnet or testnet)
 * @returns WIF-encoded private key string
 */
export function privateKeyToWIF(privateKeyBytes: Uint8Array, network: Network = Network.Mainnet): string {
  const version = WIF_VERSION[network];

  // Append compression flag (0x01) for compressed public key
  const payload = new Uint8Array(privateKeyBytes.length + 1);
  payload.set(privateKeyBytes);
  payload[privateKeyBytes.length] = 0x01;

  return base58CheckEncode(version, payload);
}

/**
 * Derive a BSV P2PKH address from a compressed public key.
 *
 * Address = Base58Check(version_byte + Hash160(compressed_pubkey))
 * Hash160 = RIPEMD160(SHA256(pubkey))
 *
 * @param compressedPubKey - 33-byte compressed public key
 * @param network - Target network (mainnet or testnet)
 * @returns BSV P2PKH address string
 */
export function publicKeyToBSVAddress(compressedPubKey: Uint8Array, network: Network = Network.Mainnet): string {
  const version = P2PKH_VERSION[network];
  const pubKeyHash = hash160(compressedPubKey);
  return base58CheckEncode(version, pubKeyHash);
}

/**
 * Derive an Ethereum address from an uncompressed public key.
 *
 * ETH Address = '0x' + Keccak256(uncompressed_pubkey_without_prefix)[-20:]
 *
 * The uncompressed public key is 65 bytes: 0x04 + x(32) + y(32).
 * We hash only the x,y coordinates (64 bytes, excluding the 0x04 prefix).
 *
 * @param uncompressedPubKey - 65-byte uncompressed public key
 * @returns Ethereum address with EIP-55 checksum
 */
export function publicKeyToEthAddress(uncompressedPubKey: Uint8Array): string {
  // Remove the 0x04 prefix byte
  const pubKeyBody = uncompressedPubKey.slice(1);
  const hash = hashKeccak256(pubKeyBody);
  // Take last 20 bytes
  const addressBytes = hash.slice(12);
  const addressHex = bytesToHex(addressBytes);

  // Apply EIP-55 checksum
  return toChecksumAddress(addressHex);
}

/**
 * Apply EIP-55 mixed-case checksum to an Ethereum address.
 *
 * @param address - lowercase hex address (without 0x prefix)
 * @returns checksummed address with 0x prefix
 */
function toChecksumAddress(address: string): string {
  const lower = address.toLowerCase();
  const hashHex = bytesToHex(hashKeccak256(new TextEncoder().encode(lower)));

  let checksummed = '0x';
  for (let i = 0; i < lower.length; i++) {
    const char = lower[i];
    if (/[a-f]/.test(char)) {
      // If the corresponding nibble of the hash is >= 8, uppercase
      const nibble = parseInt(hashHex[i], 16);
      checksummed += nibble >= 8 ? char.toUpperCase() : char;
    } else {
      checksummed += char;
    }
  }

  return checksummed;
}

/**
 * Convert an Ethereum private key to a Bitcoin SV private key.
 *
 * This is the main entry point for the conversion protocol.
 * Since both chains use secp256k1, the raw private key bytes are identical.
 * This function handles format conversion and address derivation.
 *
 * @param ethPrivateKey - Ethereum private key (hex string, with or without 0x prefix)
 * @param options - Conversion options (network, etc.)
 * @returns Complete conversion result with both ETH and BSV keys/addresses
 *
 * @example
 * ```typescript
 * const result = convertEthToBSV('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
 * console.log(result.bsvPrivateKeyWIF);  // WIF-encoded BSV private key
 * console.log(result.bsvAddress);         // BSV P2PKH address
 * console.log(result.ethAddress);         // Original ETH address (for verification)
 * ```
 */
export function convertEthToBSV(ethPrivateKey: HexPrivateKey, options: ConversionOptions = {}): ConversionResult {
  const network = options.network ?? Network.Mainnet;

  // Step 1: Normalize and validate the Ethereum private key
  const normalizedHex = normalizeHexKey(ethPrivateKey);
  const privateKeyBytes = hexToBytes(normalizedHex);

  // Step 2: Derive public keys (same private key, same curve)
  const compressedPubKey = deriveCompressedPublicKey(privateKeyBytes);
  const uncompressedPubKey = deriveUncompressedPublicKey(privateKeyBytes);

  // Step 3: Encode private key as WIF for BSV
  const bsvWIF = privateKeyToWIF(privateKeyBytes, network);

  // Step 4: Derive BSV P2PKH address
  const bsvAddress = publicKeyToBSVAddress(compressedPubKey, network);

  // Step 5: Derive Ethereum address for cross-verification
  const ethAddress = publicKeyToEthAddress(uncompressedPubKey);

  return {
    ethPrivateKey: normalizedHex,
    ethAddress,
    bsvPrivateKeyWIF: bsvWIF,
    bsvAddress,
    compressedPublicKey: bytesToHex(compressedPubKey),
    uncompressedPublicKey: bytesToHex(uncompressedPubKey),
    network,
  };
}
