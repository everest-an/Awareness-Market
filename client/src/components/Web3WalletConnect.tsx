import { useState, useEffect } from 'react';
import { BrowserProvider, Contract, parseUnits } from 'ethers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// USDT Contract ABI (ERC-20 standard)
const USDT_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

// USDT Contract Address (Ethereum Mainnet)
const USDT_CONTRACT_ADDRESS = '0xdac17f958d2ee523a2206206994597c13d831ec7';

// Payment recipient address (should be configured in env)
const PAYMENT_RECIPIENT = process.env.VITE_PAYMENT_WALLET_ADDRESS || '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';

interface Web3WalletConnectProps {
  planId: string;
  amount: number; // USDT amount
  onSuccess?: (txHash: string) => void;
  onError?: (error: Error) => void;
}

export default function Web3WalletConnect({ planId, amount, onSuccess, onError }: Web3WalletConnectProps) {
  const [account, setAccount] = useState<string | null>(null);
  const [balance, setBalance] = useState<string>('0');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    checkWalletConnection();
  }, []);

  const checkWalletConnection = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const provider = new BrowserProvider(window.ethereum);
        const accounts = await provider.listAccounts();
        if (accounts.length > 0) {
          setAccount(accounts[0].address);
          await fetchBalance(accounts[0].address);
        }
      } catch (error) {
        console.error('Failed to check wallet connection:', error);
      }
    }
  };

  const fetchBalance = async (address: string) => {
    try {
      const provider = new BrowserProvider(window.ethereum);
      const usdtContract = new Contract(USDT_CONTRACT_ADDRESS, USDT_ABI, provider);
      const balance = await usdtContract.balanceOf(address);
      const decimals = await usdtContract.decimals();
      const formattedBalance = (Number(balance) / Math.pow(10, Number(decimals))).toFixed(2);
      setBalance(formattedBalance);
    } catch (error) {
      console.error('Failed to fetch USDT balance:', error);
    }
  };

  const connectWallet = async () => {
    if (typeof window.ethereum === 'undefined') {
      toast.error('Please install MetaMask to use Web3 wallet');
      return;
    }

    setIsConnecting(true);
    try {
      const provider = new BrowserProvider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      setAccount(accounts[0]);
      await fetchBalance(accounts[0]);
      toast.success('Wallet connected successfully');
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      toast.error('Failed to connect wallet');
      onError?.(error as Error);
    } finally {
      setIsConnecting(false);
    }
  };

  const payWithUSDT = async () => {
    if (!account) {
      toast.error('Please connect your wallet first');
      return;
    }

    setIsProcessing(true);
    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const usdtContract = new Contract(USDT_CONTRACT_ADDRESS, USDT_ABI, signer);

      // Get decimals
      const decimals = await usdtContract.decimals();
      const amountInWei = parseUnits(amount.toString(), decimals);

      // Send transaction
      toast.info('Please confirm the transaction in your wallet...');
      const tx = await usdtContract.transfer(PAYMENT_RECIPIENT, amountInWei);
      
      toast.info('Transaction submitted. Waiting for confirmation...');
      const receipt = await tx.wait();

      toast.success('Payment successful!');
      onSuccess?.(receipt.hash);
    } catch (error: any) {
      console.error('Payment failed:', error);
      if (error.code === 'ACTION_REJECTED') {
        toast.error('Transaction rejected by user');
      } else {
        toast.error(error.message || 'Payment failed');
      }
      onError?.(error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Pay with Crypto (USDT)
        </CardTitle>
        <CardDescription>
          Connect your Web3 wallet and pay with USDT on Ethereum
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!account ? (
          <Button
            className="w-full"
            onClick={connectWallet}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Wallet className="mr-2 h-4 w-4" />
                Connect Wallet
              </>
            )}
          </Button>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Connected Wallet</p>
              <p className="font-mono text-sm mt-1">
                {account.slice(0, 6)}...{account.slice(-4)}
              </p>
              <p className="text-sm text-muted-foreground mt-2">USDT Balance</p>
              <p className="font-medium">{balance} USDT</p>
            </div>

            <div className="p-4 bg-primary/10 rounded-lg">
              <p className="text-sm text-muted-foreground">Payment Amount</p>
              <p className="text-2xl font-bold">{amount} USDT</p>
              <p className="text-xs text-muted-foreground mt-1">
                Plan: {planId}
              </p>
            </div>

            <Button
              className="w-full"
              onClick={payWithUSDT}
              disabled={isProcessing || Number(balance) < amount}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : Number(balance) < amount ? (
                'Insufficient USDT Balance'
              ) : (
                `Pay ${amount} USDT`
              )}
            </Button>

            {Number(balance) < amount && (
              <p className="text-sm text-destructive text-center">
                You need at least {amount} USDT to complete this payment
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
