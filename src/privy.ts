/**
 * Privy Integration Module for ETH-to-BSV Key Conversion Protocol.
 *
 * This module integrates with Privy's wallet infrastructure to:
 * 1. Create Ethereum wallets via Privy
 * 2. Export the private key from Privy wallets
 * 3. Convert the exported ETH private key to BSV format
 *
 * Flow:
 *   Privy Wallet (ETH) → Export Private Key → Convert to BSV (WIF + Address)
 *
 * Requirements:
 *   - Privy App ID and App Secret (from Privy Dashboard)
 *   - @privy-io/node SDK
 */

import { PrivyClient } from '@privy-io/node';
import { convertEthToBSV } from './converter';
import { Network, type ConversionResult, type ConversionOptions } from './types';

/** Configuration for the Privy-BSV bridge */
export interface PrivyBSVConfig {
  /** Privy App ID from the Privy Dashboard */
  appId: string;
  /** Privy App Secret from the Privy Dashboard */
  appSecret: string;
  /** Optional Privy API URL override */
  apiUrl?: string;
  /** BSV network (default: mainnet) */
  network?: Network;
}

/** Result of creating a wallet and converting keys */
export interface PrivyBSVWalletResult {
  /** Privy wallet ID */
  privyWalletId: string;
  /** Privy wallet Ethereum address */
  privyWalletAddress: string;
  /** Full conversion result (ETH + BSV keys and addresses) */
  conversion: ConversionResult;
}

/** Authorization context for wallet operations requiring owner authorization */
export interface AuthorizationContext {
  /** Authorization private keys for server-controlled wallets */
  authorizationPrivateKeys?: string[];
  /** User JWTs for user-owned wallets */
  userJwts?: string[];
}

/**
 * PrivyBSVBridge: Connects Privy wallet infrastructure with BSV key derivation.
 *
 * This class provides a high-level API to:
 * - Create ETH wallets via Privy and automatically derive BSV keys
 * - Export existing Privy wallet keys and convert them to BSV format
 * - Manage the full lifecycle of cross-chain wallet provisioning
 *
 * @example
 * ```typescript
 * const bridge = new PrivyBSVBridge({
 *   appId: 'your-privy-app-id',
 *   appSecret: 'your-privy-app-secret',
 * });
 *
 * // Create a new wallet with both ETH and BSV keys
 * const result = await bridge.createWalletWithBSV();
 * console.log(result.conversion.bsvPrivateKeyWIF);
 * console.log(result.conversion.bsvAddress);
 *
 * // Or convert an existing Privy wallet
 * const bsvKeys = await bridge.exportAndConvert('wallet-id');
 * ```
 */
export class PrivyBSVBridge {
  private privy: PrivyClient;
  private network: Network;

  constructor(config: PrivyBSVConfig) {
    this.privy = new PrivyClient({
      appId: config.appId,
      appSecret: config.appSecret,
      ...(config.apiUrl ? { apiUrl: config.apiUrl } : {}),
    });
    this.network = config.network ?? Network.Mainnet;
  }

  /**
   * Create a new Ethereum wallet via Privy and derive BSV keys from it.
   *
   * This method:
   * 1. Creates an Ethereum wallet using Privy's Wallet API
   * 2. Exports the private key from the newly created wallet
   * 3. Converts the ETH private key to BSV WIF format
   * 4. Derives the BSV P2PKH address
   *
   * @param options - Optional parameters for wallet creation
   * @returns Wallet IDs, addresses, and full conversion result
   */
  async createWalletWithBSV(options?: {
    /** Owner user ID for user-owned wallets */
    userId?: string;
    /** Authorization context for export */
    authorizationContext?: AuthorizationContext;
  }): Promise<PrivyBSVWalletResult> {
    // Step 1: Create an Ethereum wallet via Privy
    const createParams: { chain_type: 'ethereum'; owner?: { user_id: string } } = {
      chain_type: 'ethereum' as const,
    };

    if (options?.userId) {
      createParams.owner = { user_id: options.userId };
    }

    const wallet = await this.privy.wallets().create(createParams);

    // Step 2: Export the private key
    const exportParams: { authorization_context?: { authorization_private_keys?: string[]; user_jwts?: string[] } } = {};
    if (options?.authorizationContext) {
      exportParams.authorization_context = {
        authorization_private_keys: options.authorizationContext.authorizationPrivateKeys,
        user_jwts: options.authorizationContext.userJwts,
      };
    }

    const { private_key } = await this.privy.wallets().export(wallet.id, exportParams);

    // Step 3: Convert ETH private key to BSV
    const conversion = convertEthToBSV(private_key, { network: this.network });

    return {
      privyWalletId: wallet.id,
      privyWalletAddress: wallet.address,
      conversion,
    };
  }

  /**
   * Export an existing Privy wallet's private key and convert to BSV.
   *
   * Use this when you already have a Privy wallet and want to derive
   * the corresponding BSV private key and address.
   *
   * @param walletId - The Privy wallet ID to export
   * @param authorizationContext - Authorization context if the wallet has an owner
   * @returns Full conversion result with ETH and BSV keys/addresses
   */
  async exportAndConvert(
    walletId: string,
    authorizationContext?: AuthorizationContext,
  ): Promise<ConversionResult> {
    const exportParams: { authorization_context?: { authorization_private_keys?: string[]; user_jwts?: string[] } } = {};
    if (authorizationContext) {
      exportParams.authorization_context = {
        authorization_private_keys: authorizationContext.authorizationPrivateKeys,
        user_jwts: authorizationContext.userJwts,
      };
    }

    const { private_key } = await this.privy.wallets().export(walletId, exportParams);
    return convertEthToBSV(private_key, { network: this.network });
  }

  /**
   * Convert a raw ETH private key to BSV format.
   *
   * This is a convenience method that doesn't interact with Privy.
   * Use it when you already have the private key and just need the conversion.
   *
   * @param ethPrivateKey - Ethereum private key (hex, with or without 0x prefix)
   * @param options - Conversion options
   * @returns Full conversion result
   */
  convertKey(ethPrivateKey: string, options?: ConversionOptions): ConversionResult {
    return convertEthToBSV(ethPrivateKey, {
      network: options?.network ?? this.network,
    });
  }

  /**
   * Get the underlying Privy client for direct API access.
   *
   * Use this if you need to call Privy APIs that aren't wrapped
   * by this bridge class.
   */
  getPrivyClient(): PrivyClient {
    return this.privy;
  }
}

/**
 * Factory function to create a PrivyBSVBridge instance.
 *
 * @example
 * ```typescript
 * const bridge = createPrivyBSVBridge({
 *   appId: process.env.PRIVY_APP_ID!,
 *   appSecret: process.env.PRIVY_APP_SECRET!,
 * });
 * ```
 */
export function createPrivyBSVBridge(config: PrivyBSVConfig): PrivyBSVBridge {
  return new PrivyBSVBridge(config);
}
