import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'wouter';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  Wallet,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Clock,
  Gift,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

const BONUS_TIERS = [
  { threshold: 100, bonus: '5%', description: 'Spend $100+' },
  { threshold: 500, bonus: '10%', description: 'Spend $500+' },
  { threshold: 1000, bonus: '15%', description: 'Spend $1,000+' },
];

export default function CreditsPayments() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [topUpAmount, setTopUpAmount] = useState('');
  const [refundTxId, setRefundTxId] = useState('');
  const [refundReason, setRefundReason] = useState('');

  const { data: balanceData, refetch: refetchBalance } = trpc.creditPayment.getBalance.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const { data: txData } = trpc.creditPayment.getTransactions.useQuery(
    { limit: 20, offset: 0 },
    { enabled: isAuthenticated }
  );

  const { data: pricingData } = trpc.creditPayment.getPricing.useQuery();

  const checkoutMutation = trpc.creditPayment.createTopUpCheckout.useMutation({
    onSuccess: (data) => {
      if (data.success && data.checkoutUrl) {
        window.open(data.checkoutUrl, '_blank');
      }
    },
    onError: (err) => {
      toast({ title: 'Checkout Failed', description: err.message, variant: 'destructive' });
    },
  });

  const refundMutation = trpc.creditPayment.requestRefund.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: 'Refund Processed', description: data.message });
        refetchBalance();
        setRefundTxId('');
        setRefundReason('');
      }
    },
    onError: (err) => {
      toast({ title: 'Refund Failed', description: err.message, variant: 'destructive' });
    },
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white">
        <Navbar />
        <div className="flex items-center justify-center pt-32">
          <Card className="p-8 bg-slate-900/50 border-slate-800 text-center max-w-md">
            <CreditCard className="h-12 w-12 text-cyan-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Sign in to manage credits</h2>
            <p className="text-slate-400 text-sm mb-4">View your balance, top up credits, and manage payments.</p>
            <Button onClick={() => setLocation('/auth')} className="bg-cyan-500 hover:bg-cyan-600">
              Sign In
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  const balance = balanceData?.balance ?? 0;
  const transactions = txData?.transactions ?? [];

  const handleTopUp = () => {
    const amount = parseFloat(topUpAmount);
    if (!amount || amount < 10 || amount > 10000) {
      toast({ title: 'Invalid Amount', description: 'Enter between $10 and $10,000', variant: 'destructive' });
      return;
    }
    checkoutMutation.mutate({
      amount,
      successUrl: `${window.location.origin}/credits?status=success`,
      cancelUrl: `${window.location.origin}/credits?status=cancelled`,
    });
  };

  const handleRefund = () => {
    const txId = parseInt(refundTxId);
    if (!txId || !refundReason || refundReason.length < 10) {
      toast({ title: 'Incomplete', description: 'Provide transaction ID and reason (10+ chars)', variant: 'destructive' });
      return;
    }
    refundMutation.mutate({ transactionId: txId, reason: refundReason });
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'top_up': return 'text-green-400';
      case 'purchase': return 'text-red-400';
      case 'refund': return 'text-yellow-400';
      case 'bonus': return 'text-cyan-400';
      default: return 'text-slate-400';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'top_up': return <ArrowDownRight className="h-4 w-4 text-green-400" />;
      case 'purchase': return <ArrowUpRight className="h-4 w-4 text-red-400" />;
      case 'refund': return <RefreshCw className="h-4 w-4 text-yellow-400" />;
      case 'bonus': return <Gift className="h-4 w-4 text-cyan-400" />;
      default: return <DollarSign className="h-4 w-4 text-slate-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <Navbar />

      <div className="max-w-5xl mx-auto pt-24 px-6 pb-12 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Wallet className="h-7 w-7 text-cyan-400" />
            Credits & Payments
          </h1>
          <p className="text-sm text-white/30 mt-1">
            Manage your credit balance, top up, and view transaction history
          </p>
        </div>

        {/* Balance Card */}
        <Card className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border-cyan-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-white/50 mb-1">Current Balance</div>
                <div className="text-4xl font-bold text-white">
                  ${balance.toFixed(2)}
                </div>
                <div className="text-xs text-white/30 mt-1">1 credit = $1.00 USD</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-white/50 mb-1">Transactions</div>
                <div className="text-2xl font-bold text-cyan-400">
                  {txData?.total ?? 0}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top Up */}
          <Card className="lg:col-span-2 bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-cyan-400" />
                Top Up Credits
              </CardTitle>
              <CardDescription>Add credits to your account via Stripe</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                {[25, 50, 100, 500].map((preset) => (
                  <Button
                    key={preset}
                    variant={topUpAmount === String(preset) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTopUpAmount(String(preset))}
                    className={topUpAmount === String(preset) ? 'bg-cyan-500 hover:bg-cyan-600' : ''}
                  >
                    ${preset}
                  </Button>
                ))}
              </div>

              <div className="flex gap-3">
                <div className="relative flex-1">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    type="number"
                    placeholder="Custom amount (10 - 10,000)"
                    value={topUpAmount}
                    onChange={(e) => setTopUpAmount(e.target.value)}
                    className="pl-9 bg-slate-800 border-slate-700 text-white"
                    min={10}
                    max={10000}
                  />
                </div>
                <Button
                  onClick={handleTopUp}
                  disabled={checkoutMutation.isPending}
                  className="bg-cyan-500 hover:bg-cyan-600 min-w-[120px]"
                >
                  {checkoutMutation.isPending ? 'Processing...' : 'Top Up'}
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Button>
              </div>

              {/* Bonus tiers */}
              <div className="flex gap-3 pt-2">
                {BONUS_TIERS.map((tier) => (
                  <div key={tier.threshold} className="flex-1 p-3 rounded-lg bg-slate-800/50 text-center">
                    <div className="text-lg font-bold text-cyan-400">{tier.bonus}</div>
                    <div className="text-xs text-slate-400">{tier.description}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Refund */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-yellow-400" />
                Request Refund
              </CardTitle>
              <CardDescription>Within 7 days of purchase</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Transaction ID"
                value={refundTxId}
                onChange={(e) => setRefundTxId(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white"
              />
              <textarea
                placeholder="Reason (min 10 chars)..."
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                className="w-full min-h-[80px] p-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm resize-none"
              />
              <Button
                onClick={handleRefund}
                disabled={refundMutation.isPending}
                variant="outline"
                className="w-full"
              >
                {refundMutation.isPending ? 'Processing...' : 'Submit Refund'}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Transaction History */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-slate-400" />
              Transaction History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {transactions.length > 0 ? (
              <div className="space-y-2">
                {transactions.map((tx: any) => (
                  <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/30 hover:bg-slate-800/50 transition-colors">
                    <div className="flex items-center gap-3">
                      {getTypeIcon(tx.type)}
                      <div>
                        <div className="text-sm text-white">{tx.description}</div>
                        <div className="text-xs text-slate-400">
                          {new Date(tx.createdAt).toLocaleDateString()} &middot; ID: {tx.id}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-bold ${getTypeColor(tx.type)}`}>
                        {tx.type === 'purchase' ? '-' : '+'}{Math.abs(tx.amount).toFixed(2)}
                      </div>
                      <div className="text-xs text-slate-400">
                        Balance: ${tx.balanceAfter?.toFixed(2) ?? '—'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                <DollarSign className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>No transactions yet</p>
                <p className="text-xs mt-1">Top up credits to get started</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
