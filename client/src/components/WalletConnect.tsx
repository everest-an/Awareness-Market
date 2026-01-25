/**
 * MetaMask 钱包连接组件
 * 提供连接、断开连接和网络切换的 UI
 */

import { useWeb3 } from '../contexts/Web3Context';
import { useEffect, useState } from 'react';
import './WalletConnect.css';

export function WalletConnect() {
  const { state, isLoading, connect, disconnect, switchToAmoy } = useWeb3();
  const [showMenu, setShowMenu] = useState(false);
  const [balanceDisplay, setBalanceDisplay] = useState<string>('0');

  // 格式化余额显�?
  useEffect(() => {
    if (state.balance) {
      const balance = parseFloat(state.balance);
      setBalanceDisplay(balance.toFixed(4));
    }
  }, [state.balance]);

  const formatAddress = (address: string | null) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleConnectClick = async () => {
    try {
      await connect();
    } catch (error) {
      console.error('Connection failed:', error);
      alert('Failed to connect wallet. Please make sure MetaMask is installed.');
    }
  };

  const handleDisconnectClick = async () => {
    try {
      await disconnect();
      setShowMenu(false);
    } catch (error) {
      console.error('Disconnection failed:', error);
    }
  };

  const handleSwitchNetworkClick = async () => {
    try {
      if (!state.isConnected) {
        alert('Please connect wallet first');
        return;
      }
      
      if (state.isOnAmoy) {
        alert('Already on Polygon Amoy network');
        return;
      }

      await switchToAmoy();
      setShowMenu(false);
    } catch (error) {
      console.error('Network switch failed:', error);
    }
  };

  // 未连接状�?- 显示连接按钮
  if (!state.isConnected) {
    return (
      <div className="wallet-connect">
        <button 
          onClick={handleConnectClick} 
          disabled={isLoading}
          className="btn-connect"
        >
          {isLoading ? 'Connecting...' : 'Connect Wallet'}
        </button>
      </div>
    );
  }

  // 连接状�?- 显示地址和菜�?
  return (
    <div className="wallet-connect">
      <div className="wallet-info">
        {state.isOnAmoy && (
          <span className="network-badge">
            <span className="network-dot"></span>
            Amoy
          </span>
        )}
        
        <button 
          onClick={() => setShowMenu(!showMenu)}
          className="btn-address"
          title={state.address || 'Unknown'}
        >
          {formatAddress(state.address)}
        </button>

        {showMenu && (
          <div className="wallet-menu">
            <div className="menu-header">
              <div className="address-display">
                <span className="label">Address:</span>
                <span className="value">{state.address}</span>
              </div>
            </div>

            <div className="menu-divider"></div>

            <div className="balance-display">
              <span className="label">Balance:</span>
              <span className="value">{balanceDisplay} MATIC</span>
            </div>

            <div className="chain-display">
              <span className="label">Network:</span>
              <span className="value">
                {state.chainName} (ID: {state.chainId})
              </span>
            </div>

            <div className="menu-divider"></div>

            {!state.isOnAmoy && (
              <button 
                onClick={handleSwitchNetworkClick}
                disabled={isLoading}
                className="btn-menu-item btn-switch-network"
              >
                {isLoading ? 'Switching...' : 'Switch to Polygon Amoy'}
              </button>
            )}

            {state.isOnAmoy && (
              <div className="network-ok">
                �?Connected to Polygon Amoy
              </div>
            )}

            <button 
              onClick={handleDisconnectClick}
              disabled={isLoading}
              className="btn-menu-item btn-disconnect"
            >
              {isLoading ? 'Disconnecting...' : 'Disconnect'}
            </button>
          </div>
        )}
      </div>

      {state.error && (
        <div className="error-message">
          {state.error}
        </div>
      )}
    </div>
  );
}
