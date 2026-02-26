/**
 * ETH-to-BSV Key Conversion Protocol
 *
 * A protocol for deterministically generating Bitcoin SV (BSV) private keys
 * from Ethereum private keys. Both chains use the secp256k1 elliptic curve,
 * so the raw 32-byte private key is mathematically identical. This library
 * handles the format conversion (hex ↔ WIF) and address derivation differences.
 *
 * @module eth-to-bsv-key-protocol
 */

export { convertEthToBSV, privateKeyToWIF, publicKeyToBSVAddress, publicKeyToEthAddress } from './converter';
export { normalizeHexKey, hexToBytes, bytesToHex, hash160, hashKeccak256 } from './crypto';
export { base58Encode, base58Decode, base58CheckEncode, base58CheckDecode } from './encoding';
export { PrivyBSVBridge, createPrivyBSVBridge } from './privy';
export { Network, WIF_VERSION, P2PKH_VERSION } from './types';
export type {
  ConversionResult,
  ConversionOptions,
  RawPrivateKey,
  HexPrivateKey,
  WIFPrivateKey,
  HexPublicKey,
  BSVAddress,
  EthAddress,
} from './types';
export type {
  PrivyBSVConfig,
  PrivyBSVWalletResult,
  AuthorizationContext,
} from './privy';
