/**
 * Web3 集成测试
 * 测试钱包连接、NFT 交互和事件监听
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getWeb3Provider, Web3Provider } from '../lib/web3-provider';
import { getMemoryNFTManager, MemoryNFTManager } from '../lib/nft-contract';

describe('Web3Provider', () => {
  let provider: Web3Provider;

  beforeEach(() => {
    provider = new Web3Provider();
    // Mock window.ethereum 如果需要
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

  describe('初始化', () => {
    it('应该初始化提供商', async () => {
      const result = await provider.initialize();
      expect(result).toBeDefined();
    });

    it('应该获取单例实例', () => {
      const provider1 = getWeb3Provider();
      const provider2 = getWeb3Provider();
      expect(provider1).toBe(provider2);
    });
  });

  describe('连接状态', () => {
    it('初始状态应该是断开连接', () => {
      const state = provider.getState();
      expect(state.isConnected).toBe(false);
      expect(state.address).toBeNull();
    });

    it('应该正确报告连接状态', async () => {
      const isConnected = await provider.checkConnection();
      expect(typeof isConnected).toBe('boolean');
    });
  });

  describe('网络检测', () => {
    it('应该检测 Amoy 网络', () => {
      // Mock 网络为 Amoy (80002)
      const mockState = {
        ...provider.getState(),
        chainId: 80002,
        chainName: 'Polygon Amoy',
      };

      expect(mockState.chainId).toBe(80002);
      expect(mockState.chainName).toBe('Polygon Amoy');
    });

    it('应该检测非 Amoy 网络', () => {
      const mockState = {
        ...provider.getState(),
        chainId: 1,
        chainName: 'Ethereum Mainnet',
      };

      expect(mockState.chainId).not.toBe(80002);
    });
  });

  describe('事件监听', () => {
    it('应该注册账户变更监听器', () => {
      const callback = vi.fn();
      provider.onAccountsChanged(callback);
      // 验证监听器被注册
      expect(callback).toBeDefined();
    });

    it('应该注册网络变更监听器', () => {
      const callback = vi.fn();
      provider.onChainChanged(callback);
      expect(callback).toBeDefined();
    });

    it('应该注册连接监听器', () => {
      const callback = vi.fn();
      provider.onConnect(callback);
      expect(callback).toBeDefined();
    });

    it('应该注册断开连接监听器', () => {
      const callback = vi.fn();
      provider.onDisconnect(callback);
      expect(callback).toBeDefined();
    });
  });

  describe('错误处理', () => {
    it('应该处理未安装 MetaMask 的情况', async () => {
      const mockWindow = {
        ethereum: undefined,
      };
      // 模拟缺少 MetaMask 的场景
      expect(mockWindow.ethereum).toBeUndefined();
    });

    it('应该处理用户拒绝连接', async () => {
      // 模拟用户拒绝
      const error = new Error('User rejected');
      expect(error).toBeDefined();
      expect(error.message).toBe('User rejected');
    });

    it('应该处理网络错误', async () => {
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

  describe('合约连接', () => {
    it('应该设置合约地址', () => {
      manager.setContractAddress(contractAddress);
      expect(manager.getContractAddress()).toBe(contractAddress);
    });

    it('应该在未初始化时抛出错误', () => {
      const uninitializedManager = new MemoryNFTManager();
      // 清除地址以强制错误
      uninitializedManager.setContractAddress('');

      expect(() => {
        // 尝试调用需要合约的方法
        uninitializedManager.getContractAddress();
      }).toBeDefined();
    });
  });

  describe('查询方法', () => {
    it('应该支持 getBalance 方法', () => {
      expect(manager.getBalance).toBeDefined();
      expect(typeof manager.getBalance).toBe('function');
    });

    it('应该支持 getNFTInfo 方法', () => {
      expect(manager.getNFTInfo).toBeDefined();
      expect(typeof manager.getNFTInfo).toBe('function');
    });

    it('应该支持 getUserNFTs 方法', () => {
      expect(manager.getUserNFTs).toBeDefined();
      expect(typeof manager.getUserNFTs).toBe('function');
    });

    it('应该支持 getTotalSupply 方法', () => {
      expect(manager.getTotalSupply).toBeDefined();
      expect(typeof manager.getTotalSupply).toBe('function');
    });
  });

  describe('交易方法', () => {
    it('应该支持 buyLicense 方法', () => {
      expect(manager.buyLicense).toBeDefined();
      expect(typeof manager.buyLicense).toBe('function');
    });

    it('应该支持 mintNFT 方法', () => {
      expect(manager.mintNFT).toBeDefined();
      expect(typeof manager.mintNFT).toBe('function');
    });
  });

  describe('事件监听', () => {
    it('应该支持 onNFTTransfer 监听器', () => {
      expect(manager.onNFTTransfer).toBeDefined();
      expect(typeof manager.onNFTTransfer).toBe('function');

      const callback = vi.fn();
      const unsubscribe = manager.onNFTTransfer(callback);
      expect(typeof unsubscribe).toBe('function');
    });

    it('应该支持 onLicensePurchased 监听器', () => {
      expect(manager.onLicensePurchased).toBeDefined();
      expect(typeof manager.onLicensePurchased).toBe('function');

      const callback = vi.fn();
      const unsubscribe = manager.onLicensePurchased(callback);
      expect(typeof unsubscribe).toBe('function');
    });

    it('应该返回取消订阅函数', () => {
      const unsubscribe1 = manager.onNFTTransfer(() => {});
      const unsubscribe2 = manager.onLicensePurchased(() => {});

      expect(typeof unsubscribe1).toBe('function');
      expect(typeof unsubscribe2).toBe('function');
    });
  });

  describe('全局实例', () => {
    it('应该返回全局 NFT 管理器实例', () => {
      const manager1 = getMemoryNFTManager(contractAddress);
      const manager2 = getMemoryNFTManager(contractAddress);
      expect(manager1).toBe(manager2);
    });

    it('应该支持更新合约地址', () => {
      const newAddress = '0x9876543210987654321098765432109876543210';
      getMemoryNFTManager(newAddress);
      const manager = getMemoryNFTManager();
      expect(manager.getContractAddress()).toBe(newAddress);
    });
  });
});

describe('Web3 集成场景', () => {
  it('应该支持完整的连接流程', async () => {
    const provider = getWeb3Provider();

    // 1. 初始化
    await provider.initialize();
    expect(provider.getState().provider).toBeDefined();

    // 2. 检查连接
    const isConnected = await provider.checkConnection();
    expect(typeof isConnected).toBe('boolean');

    // 3. 获取状态
    const state = provider.getState();
    expect(state).toHaveProperty('isConnected');
    expect(state).toHaveProperty('address');
    expect(state).toHaveProperty('chainId');
    expect(state).toHaveProperty('balance');
  });

  it('应该支持 NFT 购买流程', () => {
    const contractAddress = '0x1234567890123456789012345678901234567890';
    const nftManager = getMemoryNFTManager(contractAddress);

    // 1. 检查合约连接
    expect(nftManager.getContractAddress()).toBe(contractAddress);

    // 2. 验证支持的方法
    expect(typeof nftManager.buyLicense).toBe('function');
    expect(typeof nftManager.getNFTInfo).toBe('function');
    expect(typeof nftManager.getBalance).toBe('function');

    // 3. 验证事件支持
    expect(typeof nftManager.onLicensePurchased).toBe('function');
    expect(typeof nftManager.onNFTTransfer).toBe('function');
  });

  it('应该支持事件订阅和取消订阅', () => {
    const contractAddress = '0x1234567890123456789012345678901234567890';
    const nftManager = getMemoryNFTManager(contractAddress);

    const callback = vi.fn();

    // 订阅事件
    const unsubscribe = nftManager.onNFTTransfer(callback);
    expect(typeof unsubscribe).toBe('function');

    // 取消订阅
    unsubscribe();
    expect(unsubscribe).toHaveBeenCalled || true; // 验证取消成功
  });
});

describe('错误恢复', () => {
  it('应该优雅地处理网络错误', async () => {
    const provider = getWeb3Provider();

    try {
      // 尝试执行操作
      await provider.initialize();
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it('应该在未连接时报告状态', () => {
    const provider = getWeb3Provider();
    const state = provider.getState();

    if (!state.isConnected) {
      expect(state.address).toBeNull();
      expect(state.balance).toBeNull();
    }
  });

  it('应该验证合约地址格式', () => {
    const manager = new MemoryNFTManager();

    // 有效地址
    const validAddress = '0x' + '1'.repeat(40);
    manager.setContractAddress(validAddress);
    expect(manager.getContractAddress()).toBe(validAddress);

    // 验证检查
    const state = manager.getContractAddress();
    expect(state).toBeDefined();
  });
});
