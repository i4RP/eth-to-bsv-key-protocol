/**
 * Type definitions for the ETH-to-BSV key conversion protocol.
 *
 * Both Ethereum and Bitcoin SV use the secp256k1 elliptic curve,
 * making the raw 32-byte private key interchangeable. The differences
 * lie in key encoding formats and address derivation schemes.
 */

/** Raw 32-byte private key as Uint8Array */
export type RawPrivateKey = Uint8Array;

/** Hex-encoded private key string (with or without 0x prefix) */
export type HexPrivateKey = string;

/** Bitcoin WIF (Wallet Import Format) encoded private key */
export type WIFPrivateKey = string;

/** Hex-encoded public key (compressed 33 bytes or uncompressed 65 bytes) */
export type HexPublicKey = string;

/** Bitcoin/BSV address string (Base58Check encoded) */
export type BSVAddress = string;

/** Ethereum address string (0x-prefixed, checksummed or lowercased) */
export type EthAddress = string;

/** Network type for BSV key encoding */
export enum Network {
  Mainnet = 'mainnet',
  Testnet = 'testnet',
}

/** Version bytes for WIF encoding */
export const WIF_VERSION: Record<Network, number> = {
  [Network.Mainnet]: 0x80,
  [Network.Testnet]: 0xef,
};

/** Version bytes for P2PKH address encoding */
export const P2PKH_VERSION: Record<Network, number> = {
  [Network.Mainnet]: 0x00,
  [Network.Testnet]: 0x6f,
};

/** Result of the key conversion protocol */
export interface ConversionResult {
  /** Original Ethereum private key (hex, without 0x prefix) */
  ethPrivateKey: HexPrivateKey;
  /** Ethereum address derived from the private key */
  ethAddress: EthAddress;
  /** BSV private key in WIF format (compressed) */
  bsvPrivateKeyWIF: WIFPrivateKey;
  /** BSV P2PKH address (compressed public key) */
  bsvAddress: BSVAddress;
  /** Compressed public key (shared between ETH and BSV, hex) */
  compressedPublicKey: HexPublicKey;
  /** Uncompressed public key (hex) */
  uncompressedPublicKey: HexPublicKey;
  /** Network used for BSV encoding */
  network: Network;
}

/** Options for the conversion */
export interface ConversionOptions {
  /** BSV network (default: mainnet) */
  network?: Network;
}
