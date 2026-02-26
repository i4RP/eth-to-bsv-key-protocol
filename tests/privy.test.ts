/**
 * Tests for Privy integration module.
 *
 * These tests mock the Privy SDK to verify the integration logic
 * without requiring actual Privy API credentials.
 */

import { PrivyBSVBridge, createPrivyBSVBridge } from '../src/privy';
import { Network } from '../src/types';

// Mock the @privy-io/node module
jest.mock('@privy-io/node', () => {
  const mockExport = jest.fn();
  const mockCreate = jest.fn();

  const mockWallets = jest.fn(() => ({
    create: mockCreate,
    export: mockExport,
    ethereum: jest.fn(() => ({})),
    solana: jest.fn(() => ({})),
  }));

  const MockPrivyClient = jest.fn(() => ({
    wallets: mockWallets,
    users: jest.fn(() => ({})),
  }));

  return {
    PrivyClient: MockPrivyClient,
    __mockCreate: mockCreate,
    __mockExport: mockExport,
  };
});

// Get mock references
const { __mockCreate: mockCreate, __mockExport: mockExport } = jest.requireMock('@privy-io/node') as {
  __mockCreate: jest.Mock;
  __mockExport: jest.Mock;
};

describe('PrivyBSVBridge', () => {
  const testConfig = {
    appId: 'test-app-id',
    appSecret: 'test-app-secret',
  };

  // A well-known test private key (Hardhat account #0)
  const testPrivateKey = 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should create bridge with default network (mainnet)', () => {
      const bridge = new PrivyBSVBridge(testConfig);
      expect(bridge).toBeDefined();
    });

    test('should create bridge with testnet network', () => {
      const bridge = new PrivyBSVBridge({ ...testConfig, network: Network.Testnet });
      expect(bridge).toBeDefined();
    });
  });

  describe('createWalletWithBSV', () => {
    test('should create wallet and convert keys', async () => {
      mockCreate.mockResolvedValue({
        id: 'wallet-123',
        address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        chain_type: 'ethereum',
      });

      mockExport.mockResolvedValue({
        private_key: testPrivateKey,
      });

      const bridge = new PrivyBSVBridge(testConfig);
      const result = await bridge.createWalletWithBSV();

      expect(result.privyWalletId).toBe('wallet-123');
      expect(result.privyWalletAddress).toBe('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
      expect(result.conversion.ethPrivateKey).toBe(testPrivateKey);
      expect(result.conversion.bsvPrivateKeyWIF).toBeDefined();
      expect(result.conversion.bsvAddress).toBeDefined();
      // BSV WIF should start with 'K' or 'L' for compressed mainnet
      expect(['K', 'L']).toContain(result.conversion.bsvPrivateKeyWIF[0]);
      // BSV address should start with '1' for mainnet
      expect(result.conversion.bsvAddress.startsWith('1')).toBe(true);
    });

    test('should create wallet with user owner', async () => {
      mockCreate.mockResolvedValue({
        id: 'wallet-456',
        address: '0x1234567890abcdef1234567890abcdef12345678',
        chain_type: 'ethereum',
      });

      mockExport.mockResolvedValue({
        private_key: testPrivateKey,
      });

      const bridge = new PrivyBSVBridge(testConfig);
      await bridge.createWalletWithBSV({ userId: 'user-789' });

      expect(mockCreate).toHaveBeenCalledWith({
        chain_type: 'ethereum',
        owner: { user_id: 'user-789' },
      });
    });

    test('should pass authorization context to export', async () => {
      mockCreate.mockResolvedValue({
        id: 'wallet-789',
        address: '0xabcdef1234567890abcdef1234567890abcdef12',
        chain_type: 'ethereum',
      });

      mockExport.mockResolvedValue({
        private_key: testPrivateKey,
      });

      const bridge = new PrivyBSVBridge(testConfig);
      await bridge.createWalletWithBSV({
        authorizationContext: {
          authorizationPrivateKeys: ['auth-key-1'],
          userJwts: ['jwt-token-1'],
        },
      });

      expect(mockExport).toHaveBeenCalledWith('wallet-789', {
        authorization_context: {
          authorization_private_keys: ['auth-key-1'],
          user_jwts: ['jwt-token-1'],
        },
      });
    });

    test('should use testnet when configured', async () => {
      mockCreate.mockResolvedValue({
        id: 'wallet-test',
        address: '0x1111111111111111111111111111111111111111',
        chain_type: 'ethereum',
      });

      mockExport.mockResolvedValue({
        private_key: testPrivateKey,
      });

      const bridge = new PrivyBSVBridge({ ...testConfig, network: Network.Testnet });
      const result = await bridge.createWalletWithBSV();

      expect(result.conversion.network).toBe(Network.Testnet);
      // Testnet WIF starts with 'c'
      expect(result.conversion.bsvPrivateKeyWIF.startsWith('c')).toBe(true);
    });
  });

  describe('exportAndConvert', () => {
    test('should export existing wallet and convert', async () => {
      mockExport.mockResolvedValue({
        private_key: testPrivateKey,
      });

      const bridge = new PrivyBSVBridge(testConfig);
      const result = await bridge.exportAndConvert('existing-wallet-id');

      expect(mockExport).toHaveBeenCalledWith('existing-wallet-id', {});
      expect(result.ethPrivateKey).toBe(testPrivateKey);
      expect(result.bsvPrivateKeyWIF).toBeDefined();
      expect(result.bsvAddress).toBeDefined();
    });

    test('should pass authorization context', async () => {
      mockExport.mockResolvedValue({
        private_key: testPrivateKey,
      });

      const bridge = new PrivyBSVBridge(testConfig);
      await bridge.exportAndConvert('wallet-id', {
        authorizationPrivateKeys: ['key-1'],
      });

      expect(mockExport).toHaveBeenCalledWith('wallet-id', {
        authorization_context: {
          authorization_private_keys: ['key-1'],
          user_jwts: undefined,
        },
      });
    });
  });

  describe('convertKey', () => {
    test('should convert key without Privy interaction', () => {
      const bridge = new PrivyBSVBridge(testConfig);
      const result = bridge.convertKey(testPrivateKey);

      expect(result.ethPrivateKey).toBe(testPrivateKey);
      expect(result.bsvPrivateKeyWIF).toBeDefined();
      expect(result.bsvAddress).toBeDefined();
      expect(result.network).toBe(Network.Mainnet);
    });

    test('should respect network override', () => {
      const bridge = new PrivyBSVBridge(testConfig);
      const result = bridge.convertKey(testPrivateKey, { network: Network.Testnet });

      expect(result.network).toBe(Network.Testnet);
    });
  });

  describe('getPrivyClient', () => {
    test('should return the underlying Privy client', () => {
      const bridge = new PrivyBSVBridge(testConfig);
      const client = bridge.getPrivyClient();
      expect(client).toBeDefined();
    });
  });
});

describe('createPrivyBSVBridge', () => {
  test('should create a PrivyBSVBridge instance', () => {
    const bridge = createPrivyBSVBridge({
      appId: 'test-id',
      appSecret: 'test-secret',
    });
    expect(bridge).toBeInstanceOf(PrivyBSVBridge);
  });
});
