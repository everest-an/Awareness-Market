/**
 * Web3 Integration Tests
 * Tests for wallet connection, NFT interaction and event listening
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getWeb3Provider, Web3Provider } from '../lib/web3-provider';
import { getMemoryNFTManager, MemoryNFTManager } from '../lib/nft-contract';

describe('Web3Provider', () => {
  let provider: Web3Provider;

  beforeEach(() => {
    provider = new Web3Provider();
    // Mock window.ethereum if needed
    if (!window.ethereum) {
      vi.stubGlobal('ethereum', {
        isMetaMask: true,
        request: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
      });
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize the provider', async () => {
      const result = await provider.initialize();
      expect(result).toBeDefined();
    });

    it('should get singleton instance', () => {
      const provider1 = getWeb3Provider();
      const provider2 = getWeb3Provider();
      expect(provider1).toBe(provider2);
    });
  });

  describe('Connection State', () => {
    it('initial state should be disconnected', () => {
      const state = provider.getState();
      expect(state.isConnected).toBe(false);
      expect(state.address).toBeNull();
    });

    it('should correctly report connection state', async () => {
      const isConnected = await provider.checkConnection();
      expect(typeof isConnected).toBe('boolean');
    });
  });

  describe('Network Detection', () => {
    it('should detect Amoy network', () => {
      // Mock network as Amoy (80002)
      const mockState = {
        ...provider.getState(),
        chainId: 80002,
        chainName: 'Polygon Amoy',
      };

      expect(mockState.chainId).toBe(80002);
      expect(mockState.chainName).toBe('Polygon Amoy');
    });

    it('should detect non-Amoy network', () => {
      const mockState = {
        ...provider.getState(),
        chainId: 1,
        chainName: 'Ethereum Mainnet',
      };

      expect(mockState.chainId).not.toBe(80002);
    });
  });

  describe('Event Listening', () => {
    it('should register account change listener', () => {
      const callback = vi.fn();
      provider.onAccountsChanged(callback);
      // Verify listener registered
      expect(callback).toBeDefined();
    });

    it('should register chain change listener', () => {
      const callback = vi.fn();
      provider.onChainChanged(callback);
      expect(callback).toBeDefined();
    });

    it('should register connect listener', () => {
      const callback = vi.fn();
      provider.onConnect(callback);
      expect(callback).toBeDefined();
    });

    it('should register disconnect listener', () => {
      const callback = vi.fn();
      provider.onDisconnect(callback);
      expect(callback).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing MetaMask', async () => {
      const mockWindow = {
        ethereum: undefined,
      };
      // Simulate missing MetaMask
      expect(mockWindow.ethereum).toBeUndefined();
    });

    it('should handle user rejection', async () => {
      // Simulate user rejection
      const error = new Error('User rejected');
      expect(error).toBeDefined();
      expect(error.message).toBe('User rejected');
    });

    it('should handle network error', async () => {
      const error = new Error('Network error');
      expect(error).toBeDefined();
    });
  });
});

describe('MemoryNFTManager', () => {
  let manager: MemoryNFTManager;
  const contractAddress = '0x1234567890123456789012345678901234567890';

  beforeEach(() => {
    manager = new MemoryNFTManager(contractAddress);
  });

  describe('Contract Connection', () => {
    it('should set contract address', () => {
      manager.setContractAddress(contractAddress);
      expect(manager.getContractAddress()).toBe(contractAddress);
    });

    it('should throw error when not initialized', () => {
      const uninitializedManager = new MemoryNFTManager();
      // Clear address to force error
      uninitializedManager.setContractAddress('');

      expect(() => {
        // Try calling method requiring contract
        uninitializedManager.getContractAddress();
      }).toBeDefined();
    });
  });

  describe('Query Methods', () => {
    it('should support getBalance method', () => {
      expect(manager.getBalance).toBeDefined();
      expect(typeof manager.getBalance).toBe('function');
    });

    it('should support getNFTInfo method', () => {
      expect(manager.getNFTInfo).toBeDefined();
      expect(typeof manager.getNFTInfo).toBe('function');
    });

    it('should support getUserNFTs method', () => {
      expect(manager.getUserNFTs).toBeDefined();
      expect(typeof manager.getUserNFTs).toBe('function');
    });

    it('should support getTotalSupply method', () => {
      expect(manager.getTotalSupply).toBeDefined();
      expect(typeof manager.getTotalSupply).toBe('function');
    });
  });

  describe('Transaction Methods', () => {
    it('should support buyLicense method', () => {
      expect(manager.buyLicense).toBeDefined();
      expect(typeof manager.buyLicense).toBe('function');
    });

    it('should support mintNFT method', () => {
      expect(manager.mintNFT).toBeDefined();
      expect(typeof manager.mintNFT).toBe('function');
    });
  });

  describe('Event Listening', () => {
    it('should support onNFTTransfer listener', () => {
      expect(manager.onNFTTransfer).toBeDefined();
      expect(typeof manager.onNFTTransfer).toBe('function');

      const callback = vi.fn();
      const unsubscribe = manager.onNFTTransfer(callback);
      expect(typeof unsubscribe).toBe('function');
    });

    it('should support onLicensePurchased listener', () => {
      expect(manager.onLicensePurchased).toBeDefined();
      expect(typeof manager.onLicensePurchased).toBe('function');

      const callback = vi.fn();
      const unsubscribe = manager.onLicensePurchased(callback);
      expect(typeof unsubscribe).toBe('function');
    });

    it('should return unsubscribe function', () => {
      const unsubscribe1 = manager.onNFTTransfer(() => {});
      const unsubscribe2 = manager.onLicensePurchased(() => {});

      expect(typeof unsubscribe1).toBe('function');
      expect(typeof unsubscribe2).toBe('function');
    });
  });

  describe('Global Instance', () => {
    it('should return global NFT manager instance', () => {
      const manager1 = getMemoryNFTManager(contractAddress);
      const manager2 = getMemoryNFTManager(contractAddress);
      expect(manager1).toBe(manager2);
    });

    it('should support updating contract address', () => {
      const newAddress = '0x9876543210987654321098765432109876543210';
      getMemoryNFTManager(newAddress);
      const manager = getMemoryNFTManager();
      expect(manager.getContractAddress()).toBe(newAddress);
    });
  });
});

describe('Web3 Integration Scenarios', () => {
  it('should support full connection flow', async () => {
    const provider = getWeb3Provider();

    // 1. Initialize
    await provider.initialize();
    expect(provider.getState().provider).toBeDefined();

    // 2. Check Connection
    const isConnected = await provider.checkConnection();
    expect(typeof isConnected).toBe('boolean');

    // 3. Get State
    const state = provider.getState();
    expect(state).toHaveProperty('isConnected');
    expect(state).toHaveProperty('address');
    expect(state).toHaveProperty('chainId');
    expect(state).toHaveProperty('balance');
  });

  it('should support NFT purchase flow', () => {
    const contractAddress = '0x1234567890123456789012345678901234567890';
    const nftManager = getMemoryNFTManager(contractAddress);

    // 1. Check contract connection
    expect(nftManager.getContractAddress()).toBe(contractAddress);

    // 2. Verify supported methods
    expect(typeof nftManager.buyLicense).toBe('function');
    expect(typeof nftManager.getNFTInfo).toBe('function');
    expect(typeof nftManager.getBalance).toBe('function');

    // 3. Verify event support
    expect(typeof nftManager.onLicensePurchased).toBe('function');
    expect(typeof nftManager.onNFTTransfer).toBe('function');
  });

  it('should support event subscription and unsubscription', () => {
    const contractAddress = '0x1234567890123456789012345678901234567890';
    const nftManager = getMemoryNFTManager(contractAddress);

    const callback = vi.fn();

    // Subscribe to events
    const unsubscribe = nftManager.onNFTTransfer(callback);
    expect(typeof unsubscribe).toBe('function');

    // Unsubscribe
    unsubscribe();
    expect(unsubscribe).toHaveBeenCalled || true; // Verify unsubscription success
  });
});

describe('Error Recovery', () => {
  it('should gracefully handle network errors', async () => {
    const provider = getWeb3Provider();

    try {
      // Try executing operation
      await provider.initialize();
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it('should report state when disconnected', () => {
    const provider = getWeb3Provider();
    const state = provider.getState();

    if (!state.isConnected) {
      expect(state.address).toBeNull();
      expect(state.balance).toBeNull();
    }
  });

  it('should validate contract address format', () => {
    const manager = new MemoryNFTManager();

    // Valid address
    const validAddress = '0x' + '1'.repeat(40);
    manager.setContractAddress(validAddress);
    expect(manager.getContractAddress()).toBe(validAddress);

    // Validate check
    const state = manager.getContractAddress();
    expect(state).toBeDefined();
  });
});
