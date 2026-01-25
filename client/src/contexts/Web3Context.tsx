/**
 * Web3 全局状态管�?Context
 * 使用 React Context 在整个应用中管理钱包连接状�?
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { getWeb3Provider } from '../lib/web3-provider';
import type { WalletState } from '../lib/web3-provider';

interface Web3ContextType {
  state: WalletState;
  isLoading: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  switchToAmoy: () => Promise<void>;
  signMessage: (message: string) => Promise<string>;
  sendTransaction: (to: string, value: string, data?: string) => Promise<string>;
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined);

export function Web3Provider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WalletState>({
    isConnected: false,
    address: null,
    chainId: null,
    chainName: null,
    balance: null,
    provider: null,
    signer: null,
    error: null,
  });

  const [isLoading, setIsLoading] = useState(false);
  const provider = getWeb3Provider();

  // 初始化提供商和检查连�?
  useEffect(() => {
    const init = async () => {
      try {
        await provider.initialize();
        const connected = await provider.checkConnection();
        if (connected) {
          setState(provider.getState());
        }
      } catch (error) {
        console.error('Failed to initialize Web3 provider:', error);
      }
    };

    init();
  }, []);

  // 监听钱包事件
  useEffect(() => {
    provider.onAccountsChanged((accounts) => {
      if (accounts.length > 0) {
        setState(provider.getState());
      }
    });

    provider.onChainChanged(() => {
      setState(provider.getState());
    });

    provider.onConnect(() => {
      setState(provider.getState());
    });

    provider.onDisconnect(() => {
      setState(provider.getState());
    });
  }, []);

  const connect = async () => {
    setIsLoading(true);
    try {
      await provider.connect();
      setState(provider.getState());
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      setState(provider.getState());
    } finally {
      setIsLoading(false);
    }
  };

  const disconnect = async () => {
    setIsLoading(true);
    try {
      await provider.disconnect();
      setState(provider.getState());
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const switchToAmoy = async () => {
    setIsLoading(true);
    try {
      await provider.switchToAmoy();
      setState(provider.getState());
    } catch (error) {
      console.error('Failed to switch network:', error);
      setState(provider.getState());
    } finally {
      setIsLoading(false);
    }
  };

  const signMessage = async (message: string) => {
    setIsLoading(true);
    try {
      return await provider.signMessage(message);
    } catch (error) {
      console.error('Failed to sign message:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const sendTransaction = async (to: string, value: string, data?: string) => {
    setIsLoading(true);
    try {
      return await provider.sendTransaction(to, value, data);
    } catch (error) {
      console.error('Failed to send transaction:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const value: Web3ContextType = {
    state,
    isLoading,
    connect,
    disconnect,
    switchToAmoy,
    signMessage,
    sendTransaction,
  };

  return (
    <Web3Context.Provider value={value}>
      {children}
    </Web3Context.Provider>
  );
}

export function useWeb3() {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error('useWeb3 must be used within Web3Provider');
  }
  return context;
}
