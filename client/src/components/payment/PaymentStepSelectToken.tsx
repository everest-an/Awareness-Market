/**
 * PaymentStepSelectToken — Step 1 of the stablecoin payment flow
 *
 * Renders the token selection UI (USDC / USDT) and displays the agent
 * wallet address. Fires `onSelect` when the user picks a token.
 */

import { ArrowRight, Copy, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import type { StablecoinSymbol } from '@/lib/web3/types';

interface TokenOptionProps {
  symbol: StablecoinSymbol;
  issuer: string;
  colorClass: string;
  balance: string | undefined;
  onSelect: (token: StablecoinSymbol) => void;
}

function TokenOption({ symbol, issuer, colorClass, balance, onSelect }: TokenOptionProps) {
  return (
    <button
      onClick={() => onSelect(symbol)}
      className="w-full flex items-center justify-between p-4 rounded-lg border hover:border-primary hover:bg-primary/5 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full ${colorClass}/10 flex items-center justify-center`}>
          <span className={`font-bold ${colorClass} text-sm`}>{symbol}</span>
        </div>
        <div className="text-left">
          <div className="font-medium">{symbol === 'USDC' ? 'USD Coin' : 'Tether USD'}</div>
          <div className="text-xs text-muted-foreground">{issuer} • Avalanche</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {balance !== undefined && (
          <span className="text-sm text-muted-foreground">
            {parseFloat(balance).toFixed(2)} available
          </span>
        )}
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </button>
  );
}

interface PaymentStepSelectTokenProps {
  title: string;
  category: string;
  priceUSD: number;
  agentWalletAddress: string | undefined;
  usdcBalance: string | undefined;
  usdtBalance: string | undefined;
  onSelect: (token: StablecoinSymbol) => void;
}

export function PaymentStepSelectToken({
  title,
  category,
  priceUSD,
  agentWalletAddress,
  usdcBalance,
  usdtBalance,
  onSelect,
}: PaymentStepSelectTokenProps) {
  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    toast.success('Address copied!');
  };

  return (
    <div className="space-y-4 py-4">
      {/* Package summary */}
      <div className="rounded-lg border bg-muted/50 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-semibold">{title}</h3>
          <Badge variant="secondary">{category}</Badge>
        </div>
        <div className="text-2xl font-bold text-primary">${priceUSD.toFixed(2)}</div>
      </div>

      <Separator />

      {/* Token options */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold">Select Payment Token</h4>
        <TokenOption
          symbol="USDC"
          issuer="Circle"
          colorClass="text-blue-500 bg-blue-500"
          balance={usdcBalance}
          onSelect={onSelect}
        />
        <TokenOption
          symbol="USDT"
          issuer="Tether"
          colorClass="text-green-500 bg-green-500"
          balance={usdtBalance}
          onSelect={onSelect}
        />
      </div>

      {/* Agent wallet address display */}
      {agentWalletAddress && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
          <Wallet className="h-3 w-3 flex-shrink-0" />
          <span>
            Agent Wallet: {agentWalletAddress.slice(0, 6)}…{agentWalletAddress.slice(-4)}
          </span>
          <button onClick={() => copyAddress(agentWalletAddress)} className="ml-auto">
            <Copy className="h-3 w-3 hover:text-primary" />
          </button>
        </div>
      )}
    </div>
  );
}
