/**
 * Web3 Integration Examples
 * Demonstrates how to use wallet and NFT contract functions in the app
 */

import React, { useEffect, useState } from 'react';
import { useWeb3 } from '../contexts/Web3Context';
import { getMemoryNFTManager } from '../lib/nft-contract';

/**
 * Example 1: Using Web3Context in components
 */
export function Web3ExampleComponent() {
  const { state, connect, disconnect, switchToAmoy } = useWeb3();

  return (
    <div>
      <h3>Web3 Status</h3>
      <p>Connection Status: {state.isConnected ? 'Connected' : 'Disconnected'}</p>
      <p>Address: {state.address}</p>
      <p>Balance: {state.balance} MATIC</p>
      <p>Network: {state.chainName} (ID: {state.chainId})</p>

      <button onClick={connect}>Connect Wallet</button>
      <button onClick={disconnect}>Disconnect</button>
      <button onClick={switchToAmoy}>Switch to Amoy Network</button>
    </div>
  );
}

/**
 * Example 2: Purchase NFT License
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

      // Purchase NFT license with tokenId 1
      const txHash = await nftManager.buyLicense(1);
      console.log('License purchase transaction:', txHash);
      alert('License purchase successful! Transaction ID: ' + txHash);
    } catch (error) {
      console.error('Purchase failed:', error);
      alert('Purchase failed: ' + (error as Error).message);
    }
  };

  return (
    <div>
      <h3>Purchase NFT License</h3>
      <button onClick={handleBuyLicense} disabled={!state.isConnected || !state.isOnAmoy}>
        Purchase License
      </button>
    </div>
  );
}

/**
 * Example 3: Get User NFTs
 */
export function UserNFTsExample() {
  const { state } = useWeb3();
  const [nfts, setNfts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

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
      console.error('Failed to get NFTs:', error);
      alert('Failed to get NFTs');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h3>My NFTs</h3>
      <button onClick={handleGetNFTs} disabled={loading || !state.isConnected}>
        {loading ? 'Loading...' : 'Get My NFTs'}
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
 * Example 4: Listen to Contract Events
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

    // Listen for NFT Transfer events
    const unsubscribeTransfer = nftManager.onNFTTransfer(
      (from, to, tokenId) => {
        console.log(`NFT ${tokenId} from ${from} transferred to ${to}`);
      }
    );

    // Listen for License Purchased events
    const unsubscribeLicense = nftManager.onLicensePurchased(
      (tokenId, buyer, price) => {
        console.log(`License Purchased: Token ${tokenId}, Buyer ${buyer}, Price ${price} Wei`);
      }
    );

    return () => {
      unsubscribeTransfer();
      unsubscribeLicense();
    };
  }, [state.isConnected]);

  return <div>Event listeners started (check console)</div>;
}

/**
 * Example 5: Signature Verification
 */
export function SignMessageExample() {
  const { state, signMessage } = useWeb3();
  const [signature, setSignature] = useState('');

  const handleSign = async () => {
    if (!state.isConnected) {
      alert('Please connect wallet');
      return;
    }

    try {
      const message = 'I agree to use this wallet';
      const sig = await signMessage(message);
      setSignature(sig);
      console.log('Signature:', sig);
    } catch (error) {
      console.error('Signature failed:', error);
      alert('Signature failed');
    }
  };

  return (
    <div>
      <h3>Signature Verification</h3>
      <button onClick={handleSign} disabled={!state.isConnected}>
        Sign
      </button>
      {signature && <p>Signature: {signature}</p>}
    </div>
  );
}
