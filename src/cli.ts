#!/usr/bin/env node

/**
 * CLI interface for ETH-to-BSV key conversion.
 *
 * Usage:
 *   npx ts-node src/cli.ts <eth_private_key> [--testnet]
 *   node dist/cli.js <eth_private_key> [--testnet]
 */

import { convertEthToBSV } from './converter';
import { Network } from './types';

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
ETH-to-BSV Key Conversion Protocol
====================================

Usage:
  eth-to-bsv <ethereum_private_key> [options]

Options:
  --testnet    Use BSV testnet encoding (default: mainnet)
  --help, -h   Show this help message

Examples:
  eth-to-bsv 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
  eth-to-bsv ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 --testnet

Protocol:
  Both Ethereum and Bitcoin SV use the secp256k1 elliptic curve.
  The raw 32-byte private key is identical on both chains.
  This tool converts the key encoding format and derives addresses.

  ETH Private Key (hex) → BSV Private Key (WIF)
  ETH Address (Keccak256) → BSV Address (Hash160 + Base58Check)
`);
    process.exit(0);
  }

  const ethPrivateKey = args[0];
  const isTestnet = args.includes('--testnet');
  const network = isTestnet ? Network.Testnet : Network.Mainnet;

  try {
    const result = convertEthToBSV(ethPrivateKey, { network });

    console.log('');
    console.log('=== ETH-to-BSV Key Conversion Result ===');
    console.log('');
    console.log(`Network:              ${result.network}`);
    console.log('');
    console.log('--- Ethereum ---');
    console.log(`Private Key (hex):    ${result.ethPrivateKey}`);
    console.log(`Address:              ${result.ethAddress}`);
    console.log('');
    console.log('--- Bitcoin SV ---');
    console.log(`Private Key (WIF):    ${result.bsvPrivateKeyWIF}`);
    console.log(`Address (P2PKH):      ${result.bsvAddress}`);
    console.log('');
    console.log('--- Shared Public Key ---');
    console.log(`Compressed:           ${result.compressedPublicKey}`);
    console.log(`Uncompressed:         ${result.uncompressedPublicKey}`);
    console.log('');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}

main();
