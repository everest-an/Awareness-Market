/**
 * Web3 集成示例
 * 展示如何在应用中使用钱包和 NFT 合约功能
 */

import { useEffect } from 'react';
import { useWeb3 } from '../context/Web3Context';
import { getMemoryNFTManager } from '../lib/nft-contract';

/**
 * 示例 1: 在组件中使用 Web3Context
 */
export function Web3ExampleComponent() {
  const { state, connect, disconnect, switchToAmoy } = useWeb3();

  return (
    <div>
      <h3>Web3 状态</h3>
      <p>连接状态: {state.isConnected ? '已连接' : '未连接'}</p>
      <p>地址: {state.address}</p>
      <p>余额: {state.balance} MATIC</p>
      <p>网络: {state.chainName} (ID: {state.chainId})</p>

      <button onClick={connect}>连接钱包</button>
      <button onClick={disconnect}>断开连接</button>
      <button onClick={switchToAmoy}>切换到 Amoy 网络</button>
    </div>
  );
}

/**
 * 示例 2: 购买 NFT 许可证
 */
export function BuyLicenseExample() {
  const { state } = useWeb3();

  const handleBuyLicense = async () => {
    if (!state.isConnected || !state.isOnAmoy) {
      alert('Please connect wallet and switch to Amoy network');
      return;
    }

    try {
      const nftManager = getMemoryNFTManager(
        process.env.REACT_APP_MEMORY_NFT_ADDRESS
      );

      // 购买 tokenId 为 1 的 NFT 许可证
      const txHash = await nftManager.buyLicense(1);
      console.log('许可证购买交易:', txHash);
      alert('许可证购买成功! 交易 ID: ' + txHash);
    } catch (error) {
      console.error('购买失败:', error);
      alert('购买失败: ' + (error as Error).message);
    }
  };

  return (
    <div>
      <h3>购买 NFT 许可证</h3>
      <button onClick={handleBuyLicense} disabled={!state.isConnected || !state.isOnAmoy}>
        购买许可证
      </button>
    </div>
  );
}

/**
 * 示例 3: 获取用户 NFT
 */
export function UserNFTsExample() {
  const { state } = useWeb3();
  const [nfts, setNfts] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);

  const handleGetNFTs = async () => {
    if (!state.isConnected || !state.address) {
      alert('Please connect wallet');
      return;
    }

    setLoading(true);
    try {
      const nftManager = getMemoryNFTManager(
        process.env.REACT_APP_MEMORY_NFT_ADDRESS
      );

      const userNFTs = await nftManager.getUserNFTs(state.address);
      setNfts(userNFTs);
    } catch (error) {
      console.error('获取 NFT 失败:', error);
      alert('获取 NFT 失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h3>我的 NFT</h3>
      <button onClick={handleGetNFTs} disabled={loading || !state.isConnected}>
        {loading ? '加载中...' : '获取我的 NFT'}
      </button>

      <ul>
        {nfts.map((nft) => (
          <li key={nft.tokenId}>
            <strong>Token ID:</strong> {nft.tokenId} |
            <strong>Owner:</strong> {nft.owner} |
            <strong>Price:</strong> {nft.price} Wei
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * 示例 4: 监听合约事件
 */
export function NFTEventListenerExample() {
  const { state } = useWeb3();

  useEffect(() => {
    if (!state.isConnected || !process.env.REACT_APP_MEMORY_NFT_ADDRESS) {
      return;
    }

    const nftManager = getMemoryNFTManager(
      process.env.REACT_APP_MEMORY_NFT_ADDRESS
    );

    // 监听 NFT 转移事件
    const unsubscribeTransfer = nftManager.onNFTTransfer(
      (from, to, tokenId) => {
        console.log(`NFT ${tokenId} 从 ${from} 转移到 ${to}`);
      }
    );

    // 监听许可证购买事件
    const unsubscribeLicense = nftManager.onLicensePurchased(
      (tokenId, buyer, price) => {
        console.log(`许可证购买: Token ${tokenId}, 购买者 ${buyer}, 价格 ${price} Wei`);
      }
    );

    return () => {
      unsubscribeTransfer();
      unsubscribeLicense();
    };
  }, [state.isConnected]);

  return <div>事件监听已启动 (检查控制台)</div>;
}

/**
 * 示例 5: 签名验证
 */
export function SignMessageExample() {
  const { state, signMessage } = useWeb3();
  const [signature, setSignature] = React.useState('');

  const handleSign = async () => {
    if (!state.isConnected) {
      alert('Please connect wallet');
      return;
    }

    try {
      const message = '我同意使用此钱包';
      const sig = await signMessage(message);
      setSignature(sig);
      console.log('签名:', sig);
    } catch (error) {
      console.error('签名失败:', error);
      alert('签名失败');
    }
  };

  return (
    <div>
      <h3>签名验证</h3>
      <button onClick={handleSign} disabled={!state.isConnected}>
        签名
      </button>
      {signature && <p>签名: {signature}</p>}
    </div>
  );
}
