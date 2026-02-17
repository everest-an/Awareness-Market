import { useState } from "react";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Wallet,
  Copy,
  ExternalLink,
  RefreshCw,
  ArrowUpRight,
  ArrowDownLeft,
  CircleDollarSign,
  Shield,
  AlertCircle,
  Check,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

export default function WalletDashboard() {
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawToken, setWithdrawToken] = useState<"USDC" | "USDT">("USDC");

  // tRPC queries
  const walletQuery = trpc.stablecoinPayment.getWallet.useQuery(undefined, {
    retry: false,
  });
  const balanceQuery = trpc.stablecoinPayment.getBalance.useQuery(undefined, {
    enabled: !!walletQuery.data?.data,
    refetchInterval: 30000,
  });
  const txQuery = trpc.stablecoinPayment.agentTransactions.useQuery(
    { limit: 20 },
    { enabled: !!walletQuery.data?.data }
  );
  const infoQuery = trpc.stablecoinPayment.getInfo.useQuery();

  // Mutations
  const withdrawMutation = trpc.stablecoinPayment.agentWithdraw.useMutation({
    onSuccess: (data) => {
      toast.success("Withdrawal initiated", {
        description: `TX: ${data.data.txHash.substring(0, 10)}...`,
      });
      balanceQuery.refetch();
      txQuery.refetch();
      setWithdrawAmount("");
    },
    onError: (err) => {
      toast.error("Withdrawal failed", { description: err.message });
    },
  });

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    toast.success("Address copied");
  };

  const wallet = walletQuery.data?.data;
  const balance = balanceQuery.data?.data;
  const transactions = txQuery.data?.data || [];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-20 container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Wallet className="h-8 w-8 text-primary" />
            Agent Wallet
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage your custody wallet for autonomous AI stablecoin payments on Polygon
          </p>
        </div>

        {walletQuery.isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : walletQuery.error ? (
          <Card className="border-destructive/50">
            <CardContent className="flex items-center gap-3 py-6">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <span>Please sign in to access your wallet.</span>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {/* Wallet Address Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Wallet Address</CardTitle>
                <CardDescription>Your Polygon custody wallet for automated transactions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono truncate">
                    {wallet?.address || "No wallet yet"}
                  </code>
                  {wallet?.address && (
                    <>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyAddress(wallet.address)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        asChild
                      >
                        <a
                          href={`https://polygonscan.com/address/${wallet.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <Shield className="h-4 w-4" />
                  Private key encrypted with AES-256-GCM — only the server can sign transactions
                </div>
              </CardContent>
            </Card>

            {/* Balance Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">MATIC</div>
                    <Badge variant="outline">Gas</Badge>
                  </div>
                  <div className="mt-2 text-2xl font-bold">
                    {balance ? parseFloat(balance.maticBalance).toFixed(4) : "—"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">For transaction fees</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">USDC</div>
                    <CircleDollarSign className="h-4 w-4 text-blue-500" />
                  </div>
                  <div className="mt-2 text-2xl font-bold">
                    ${balance ? parseFloat(balance.usdcBalance).toFixed(2) : "—"}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">USDT</div>
                    <CircleDollarSign className="h-4 w-4 text-green-500" />
                  </div>
                  <div className="mt-2 text-2xl font-bold">
                    ${balance ? parseFloat(balance.usdtBalance).toFixed(2) : "—"}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Deposit Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ArrowDownLeft className="h-5 w-5 text-green-500" />
                  Deposit
                </CardTitle>
                <CardDescription>
                  Send USDC or USDT on Polygon network to your wallet address above
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-2 rounded-lg bg-primary/10 p-3 text-sm">
                  <AlertCircle className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                  <div>
                    <p className="font-medium">Important</p>
                    <p className="text-muted-foreground">
                      Only send assets on the <strong>Polygon (MATIC)</strong> network.
                      Sending on other networks will result in permanent loss.
                      Also ensure you send some MATIC for gas fees.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Withdraw */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ArrowUpRight className="h-5 w-5 text-orange-500" />
                  Withdraw
                </CardTitle>
                <CardDescription>
                  Send stablecoins from your custody wallet to an external address
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-sm">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">
                    Withdrawals transfer tokens from the payment contract back to your custody wallet above.
                  </span>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-sm font-medium mb-1.5 block">Amount (USD)</label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Token</label>
                    <div className="flex gap-1">
                      <Button
                        variant={withdrawToken === "USDC" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setWithdrawToken("USDC")}
                        className="h-9"
                      >
                        USDC
                      </Button>
                      <Button
                        variant={withdrawToken === "USDT" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setWithdrawToken("USDT")}
                        className="h-9"
                      >
                        USDT
                      </Button>
                    </div>
                  </div>
                </div>
                <Button
                  onClick={() => {
                    if (!withdrawAmount) {
                      toast.error("Please enter an amount");
                      return;
                    }
                    withdrawMutation.mutate({
                      amount: parseFloat(withdrawAmount).toString(),
                      token: withdrawToken,
                    });
                  }}
                  disabled={withdrawMutation.isPending || !withdrawAmount}
                >
                  {withdrawMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <ArrowUpRight className="mr-2 h-4 w-4" />
                      Withdraw {withdrawToken}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Spending Limits */}
            {wallet && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Spending Limits</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Daily Limit</span>
                      <div className="text-lg font-semibold">${wallet.dailySpendLimit?.toFixed(2) || "500.00"}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Per Transaction</span>
                      <div className="text-lg font-semibold">${wallet.perTxSpendLimit?.toFixed(2) || "100.00"}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Transaction History */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Transaction History</CardTitle>
                    <CardDescription>Recent stablecoin transactions</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => txQuery.refetch()}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {transactions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No transactions yet. Purchase an AI capability with USDC/USDT to get started.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {transactions.map((tx: any) => (
                      <div key={tx.id} className="flex items-center justify-between rounded-lg border p-3">
                        <div className="flex items-center gap-3">
                          {tx.action === "purchase" ? (
                            <ArrowUpRight className="h-4 w-4 text-orange-500" />
                          ) : tx.action === "deposit" ? (
                            <ArrowDownLeft className="h-4 w-4 text-green-500" />
                          ) : (
                            <ArrowUpRight className="h-4 w-4 text-red-500" />
                          )}
                          <div>
                            <div className="text-sm font-medium capitalize">{tx.action}</div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(tx.createdAt).toLocaleDateString()} · {tx.token}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold">
                            {tx.action === "deposit" ? "+" : "-"}${parseFloat(tx.amountUSD).toFixed(2)}
                          </span>
                          {tx.txHash && (
                            <a
                              href={`https://polygonscan.com/tx/${tx.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-primary"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Contract Info */}
            {infoQuery.data && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Contract Info</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Network</span>
                    <span>Polygon Mainnet (137)</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payment Contract</span>
                    <a
                      href={`https://polygonscan.com/address/${infoQuery.data.data.contractAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary hover:underline font-mono text-xs"
                    >
                      {infoQuery.data.data.contractAddress.substring(0, 10)}...
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Supported Tokens</span>
                    <span>USDC, USDT</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
