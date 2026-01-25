# Web3 MetaMask 集成指南

## 概述

本指南涵盖了 Awareness Market 中完整的 Web3 和 MetaMask 集成，包括钱包连接、合约交互和 NFT 管理。

## 架构

### 核心模块

```
client/src/
├── lib/
│   ├── web3-provider.ts          # 核心 Web3 提供商（ethers.js 包装）
│   └── nft-contract.ts           # NFT 合约交互模块
├── context/
│   └── Web3Context.tsx           # React Context 全局状态管理
└── components/
    ├── WalletConnect.tsx         # 钱包连接 UI 组件
    ├── WalletConnect.css         # 样式
    └── Web3Examples.tsx          # 使用示例
```

## 核心组件

### 1. Web3Provider (`lib/web3-provider.ts`)

高级 `ethers.js v6` 包装类，处理所有钱包操作。

**主要功能：**
- 初始化和连接管理
- 网络切换（Polygon Amoy）
- 消息签名
- 交易发送
- 合约实例创建
- 事件监听

**使用方式：**

```typescript
import { getWeb3Provider } from '@/lib/web3-provider';

const provider = getWeb3Provider();

// 初始化
await provider.initialize();

// 连接钱包
await provider.connect();

// 检查 Polygon Amoy
if (!provider.isOnAmoy()) {
  await provider.switchToAmoy();
}

// 获取状态
const state = provider.getState();
console.log(state.address, state.balance, state.chainId);

// 签名消息
const signature = await provider.signMessage('Message to sign');

// 发送交易
const txHash = await provider.sendTransaction(
  '0xRecipientAddress',
  '1.5', // MATIC
  '0xOptionalData'
);

// 事件监听
provider.onAccountsChanged((accounts) => {
  console.log('Accounts changed:', accounts);
});

provider.onChainChanged(() => {
  console.log('Network changed');
});
```

### 2. Web3Context (`context/Web3Context.tsx`)

React Context，在整个应用中提供全局钱包状态。

**提供的值：**

```typescript
interface Web3ContextType {
  state: WalletState;           // 当前钱包状态
  isLoading: boolean;           // 操作加载状态
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  switchToAmoy: () => Promise<void>;
  signMessage: (message: string) => Promise<string>;
  sendTransaction: (to, value, data?) => Promise<string>;
}
```

**WalletState：**

```typescript
interface WalletState {
  isConnected: boolean;
  address: string | null;
  chainId: number | null;
  chainName: string | null;
  balance: string | null;  // Wei
  provider: Provider | null;
  signer: Signer | null;
  isOnAmoy: boolean;
  error: string | null;
}
```

### 3. WalletConnect 组件 (`components/WalletConnect.tsx`)

开箱即用的钱包连接 UI 组件。

**功能：**
- 连接/断开钱包
- 显示账户地址（缩写）
- 显示余额
- 网络信息
- 切换到 Polygon Amoy
- 网络状态指示器

**使用方式：**

```tsx
import { WalletConnect } from '@/components/WalletConnect';

function Header() {
  return (
    <nav>
      <h1>My App</h1>
      <WalletConnect />
    </nav>
  );
}
```

### 4. MemoryNFTManager (`lib/nft-contract.ts`)

处理与 MemoryNFT 合约的所有交互。

**主要方法：**

```typescript
import { getMemoryNFTManager } from '@/lib/nft-contract';

const nftManager = getMemoryNFTManager('0xContractAddress');

// 获取账户的 NFT 余额
const balance = await nftManager.getBalance(address);

// 获取 NFT 信息
const nftInfo = await nftManager.getNFTInfo(tokenId);
// {
//   tokenId, owner, uri, price, licensePrice, royalty
// }

// 购买许可证
const txHash = await nftManager.buyLicense(tokenId);

// 铸造新 NFT
const txHash = await nftManager.mintNFT(
  toAddress,
  metadata, // { name, description, image, attributes }
  1.5 // price in MATIC
);

// 获取总供应量
const total = await nftManager.getTotalSupply();

// 获取用户的所有 NFT
const userNFTs = await nftManager.getUserNFTs(address);

// 监听事件
const unsubscribe = nftManager.onNFTTransfer(
  (from, to, tokenId) => {
    console.log(`NFT ${tokenId} transferred from ${from} to ${to}`);
  }
);
```

## 使用示例

### 示例 1：基础钱包连接

```tsx
import { useWeb3 } from '@/context/Web3Context';

function MyComponent() {
  const { state, connect, disconnect } = useWeb3();

  return (
    <div>
      {state.isConnected ? (
        <>
          <p>Connected: {state.address}</p>
          <button onClick={disconnect}>Disconnect</button>
        </>
      ) : (
        <button onClick={connect}>Connect Wallet</button>
      )}
    </div>
  );
}
```

### 示例 2：购买 NFT 许可证

```tsx
import { useWeb3 } from '@/context/Web3Context';
import { getMemoryNFTManager } from '@/lib/nft-contract';

function BuyLicense({ nftId }) {
  const { state, isLoading } = useWeb3();

  const handleBuy = async () => {
    if (!state.isConnected || !state.isOnAmoy) {
      alert('Please connect to Polygon Amoy');
      return;
    }

    try {
      const nftManager = getMemoryNFTManager(
        import.meta.env.VITE_MEMORY_NFT_ADDRESS
      );

      const txHash = await nftManager.buyLicense(nftId);
      console.log('Purchase successful:', txHash);
    } catch (error) {
      console.error('Purchase failed:', error);
    }
  };

  return (
    <button
      onClick={handleBuy}
      disabled={isLoading || !state.isConnected || !state.isOnAmoy}
    >
      {isLoading ? 'Processing...' : 'Buy License'}
    </button>
  );
}
```

### 示例 3：获取用户 NFT

```tsx
import { useWeb3 } from '@/context/Web3Context';
import { getMemoryNFTManager } from '@/lib/nft-contract';
import { useEffect, useState } from 'react';

function MyNFTs() {
  const { state } = useWeb3();
  const [nfts, setNfts] = useState([]);

  useEffect(() => {
    if (state.address && state.isConnected) {
      const nftManager = getMemoryNFTManager(
        import.meta.env.VITE_MEMORY_NFT_ADDRESS
      );

      nftManager.getUserNFTs(state.address).then(setNfts);
    }
  }, [state.address, state.isConnected]);

  return (
    <div>
      <h2>My NFTs</h2>
      {nfts.map((nft) => (
        <div key={nft.tokenId}>
          <p>Token ID: {nft.tokenId}</p>
          <p>Owner: {nft.owner}</p>
          <p>Price: {nft.price} Wei</p>
        </div>
      ))}
    </div>
  );
}
```

### 示例 4：监听合约事件

```tsx
import { getMemoryNFTManager } from '@/lib/nft-contract';
import { useEffect } from 'react';

function NFTEventListener() {
  useEffect(() => {
    const nftManager = getMemoryNFTManager(
      import.meta.env.VITE_MEMORY_NFT_ADDRESS
    );

    // 监听 NFT 转移
    const unsubscribeTransfer = nftManager.onNFTTransfer(
      (from, to, tokenId) => {
        console.log(`NFT ${tokenId} transferred from ${from} to ${to}`);
      }
    );

    // 监听许可证购买
    const unsubscribeLicense = nftManager.onLicensePurchased(
      (tokenId, buyer, price) => {
        console.log(`License bought: Token ${tokenId}, Buyer ${buyer}, Price ${price}`);
      }
    );

    return () => {
      unsubscribeTransfer();
      unsubscribeLicense();
    };
  }, []);

  return <div>Events listener active</div>;
}
```

## 环境配置

### .env.local 设置

```env
# 前端 Web3 配置
VITE_MEMORY_NFT_ADDRESS=0x...     # MemoryNFT 合约地址
REACT_APP_MEMORY_NFT_ADDRESS=0x...  # 备选格式

# RPC 端点
VITE_AMOY_RPC_URL=https://rpc-amoy.polygon.technology/

# 部署用
DEPLOYER_PRIVATE_KEY=0x...
```

### 获取部署后的合约地址

1. 运行部署脚本：
   ```bash
   npm run deploy:memory-nft
   ```

2. 复制输出的合约地址到 `.env.local`：
   ```env
   VITE_MEMORY_NFT_ADDRESS=0x...
   ```

3. 重启开发服务器

## Polygon Amoy 网络配置

### 网络信息

| 属性 | 值 |
|------|-----|
| Network Name | Polygon Amoy |
| Chain ID | 80002 |
| RPC URL | https://rpc-amoy.polygon.technology/ |
| Block Explorer | https://amoy.polygonscan.com |
| Currency | POL |

### MetaMask 手动添加

如果 MetaMask 不能自动识别网络，手动添加：

1. 打开 MetaMask
2. 点击网络选择下拉菜单
3. 点击 "Add Network"
4. 填入以上信息
5. 保存

### 获取测试币

从 [Polygon Faucet](https://faucet.polygon.technology/) 获取免费的 POL 测试币。

## 事件和回调

### Web3Provider 事件

```typescript
// 账户变更
provider.onAccountsChanged((accounts) => {
  console.log('New accounts:', accounts);
});

// 网络变更
provider.onChainChanged(() => {
  console.log('Network changed');
});

// 连接成功
provider.onConnect(() => {
  console.log('Connected');
});

// 断开连接
provider.onDisconnect(() => {
  console.log('Disconnected');
});
```

### NFT 合约事件

```typescript
// NFT 转移事件
nftManager.onNFTTransfer((from, to, tokenId) => {
  // 处理转移
});

// 许可证购买事件
nftManager.onLicensePurchased((tokenId, buyer, price) => {
  // 处理购买
});
```

## 错误处理

### 常见错误

```typescript
try {
  await provider.connect();
} catch (error) {
  if (error.code === 'WALLET_NOT_INSTALLED') {
    console.log('MetaMask not installed');
  } else if (error.code === 'USER_REJECTED') {
    console.log('User rejected connection');
  } else if (error.code === 'NETWORK_ERROR') {
    console.log('Network error');
  }
}
```

### 网络切换失败

```typescript
try {
  await provider.switchToAmoy();
} catch (error) {
  // 如果网络不存在，MetaMask 会提示添加网络
  console.log('Failed to switch network:', error);
}
```

## 最佳实践

### 1. 总是检查连接状态

```typescript
if (!state.isConnected) {
  return <div>Please connect wallet</div>;
}

if (!state.isOnAmoy) {
  return <button onClick={switchToAmoy}>Switch to Amoy</button>;
}
```

### 2. 正确处理加载状态

```tsx
<button disabled={isLoading || !state.isConnected}>
  {isLoading ? 'Processing...' : 'Buy'}
</button>
```

### 3. 使用 useEffect 清理事件监听

```typescript
useEffect(() => {
  const unsubscribe = nftManager.onNFTTransfer(callback);
  return () => unsubscribe();
}, []);
```

### 4. 验证用户权限

```typescript
// 在执行操作前总是要求签名或连接
const signature = await provider.signMessage('Operation confirmation');
// 服务器端验证签名
```

### 5. 使用环境变量管理配置

```typescript
const contractAddress = import.meta.env.VITE_MEMORY_NFT_ADDRESS;
if (!contractAddress) {
  throw new Error('NFT contract address not configured');
}
```

## 测试

### 本地测试

1. 安装 MetaMask 浏览器扩展
2. 配置 Polygon Amoy 网络
3. 从 faucet 获取测试 POL
4. 启动开发服务器：`npm run dev`
5. 访问 `http://localhost:5173`
6. 测试钱包连接和 NFT 交互

### 单元测试示例

```typescript
import { vi } from 'vitest';
import { getWeb3Provider } from '@/lib/web3-provider';

describe('Web3Provider', () => {
  it('should initialize provider', async () => {
    const provider = getWeb3Provider();
    await provider.initialize();
    expect(provider.getState().provider).toBeDefined();
  });

  it('should handle connection', async () => {
    const provider = getWeb3Provider();
    await provider.initialize();
    const address = await provider.connect();
    expect(address).toBeDefined();
  });
});
```

## 故障排除

### MetaMask 未显示

- 确保浏览器安装了 MetaMask
- 检查 `window.ethereum` 是否可用
- 尝试刷新页面

### 交易失败

- 确保有足够的 POL 来支付 gas
- 检查合约地址是否正确
- 验证账户有正确的权限

### 网络切换失败

- 确保 RPC URL 正确
- 检查网络 ID 是否为 80002
- 手动在 MetaMask 中添加网络

### "合约未初始化"错误

- 调用 `setContractAddress()` 设置合约地址
- 确保地址格式正确（以 0x 开头）
- 检查合约在区块链上是否存在

## 下一步

1. [部署 MemoryNFT 合约](./DEPLOYMENT_MEMORY_NFT.md)
2. [集成 Stripe 支付](./STRIPE_INTEGRATION.md)
3. [创建 NFT 市场 UI](../client/src/pages/MemoryMarketplace.tsx)
4. [设置 Web3 测试](../test/web3.test.ts)

## 参考资源

- [ethers.js 文档](https://docs.ethers.org/v6/)
- [MetaMask 开发者文档](https://docs.metamask.io/)
- [Polygon 开发者文档](https://polygon.technology/developers)
- [ERC-721 标准](https://eips.ethereum.org/EIPS/eip-721)
- [ERC-6551 标准](https://eips.ethereum.org/EIPS/eip-6551)
