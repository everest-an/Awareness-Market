import { useState } from 'react';
import { useRoute, Link } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Navbar from '@/components/Navbar';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  ShoppingCart,
  ExternalLink,
  Copy,
  Check,
  TrendingUp,
  Award,
  GitBranch,
  Wallet,
  Info,
} from 'lucide-react';

export default function MemoryNFTDetail() {
  const { toast } = useToast();
  const [, params] = useRoute('/memory/:id');
  const nftId = params?.id || '';
  const [copied, setCopied] = useState(false);

  // Fetch Memory NFT details
  const { data: nft, isLoading } = trpc.memoryNFT.getDetail.useQuery(
    { nftId },
    { enabled: !!nftId }
  );

  // Fetch provenance (family tree)
  const { data: provenance } = trpc.memoryNFT.getProvenance.useQuery(
    { memoryId: nftId },
    { enabled: !!nftId }
  );

  // Fetch creator credit score
  const { data: creatorScore } = trpc.agentCredit.getProfile.useQuery(
    { agentAddress: nft?.owner || '' },
    { enabled: !!nft?.owner }
  );

  const purchaseMutation = trpc.memoryNFT.purchase.useMutation({
    onSuccess: () => {
      toast({
        title: 'Purchase Successful',
        description: 'Memory NFT has been added to your collection',
      });
    },
    onError: (error) => {
      toast({
        title: 'Purchase Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: 'Copied',
      description: 'Address copied to clipboard',
    });
  };

  const getCertificationColor = (cert: string) => {
    switch (cert) {
      case 'platinum': return 'bg-purple-500';
      case 'gold': return 'bg-yellow-500';
      case 'silver': return 'bg-gray-400';
      case 'bronze': return 'bg-orange-600';
      default: return 'bg-gray-500';
    }
  };

  const getCreditGradeColor = (grade: string) => {
    switch (grade) {
      case 'S': return 'text-purple-400';
      case 'A': return 'text-green-400';
      case 'B': return 'text-blue-400';
      case 'C': return 'text-yellow-400';
      case 'D': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <Navbar />
        <div className="container mx-auto px-4 py-16">
          <div className="text-center text-white">Loading...</div>
        </div>
      </div>
    );
  }

  if (!nft) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <Navbar />
        <div className="container mx-auto px-4 py-16">
          <div className="text-center text-white">Memory NFT not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <Link href="/memory-marketplace">
          <Button variant="ghost" className="mb-6 text-slate-300 hover:text-white">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Marketplace
          </Button>
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header Card */}
            <Card className="p-8 bg-slate-900/50 border-slate-800">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-3xl font-bold text-white mb-2">{nft.name}</h1>
                  <p className="text-slate-400">{nft.description}</p>
                </div>
                <Badge className={`${getCertificationColor(nft.certification || 'bronze')} text-white`}>
                  {nft.certification?.toUpperCase() || 'BRONZE'}
                </Badge>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-3 gap-4 mt-6">
                <div className="text-center p-4 bg-slate-800/50 rounded-lg">
                  <div className="text-2xl font-bold text-cyan-400">{nft.epsilon}%</div>
                  <div className="text-sm text-slate-400 mt-1">Epsilon (Loss)</div>
                </div>
                <div className="text-center p-4 bg-slate-800/50 rounded-lg">
                  <div className="text-2xl font-bold text-green-400">{nft.qualityGrade}</div>
                  <div className="text-sm text-slate-400 mt-1">Quality Grade</div>
                </div>
                <div className="text-center p-4 bg-slate-800/50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-400">{nft.memoryType}</div>
                  <div className="text-sm text-slate-400 mt-1">Memory Type</div>
                </div>
              </div>
            </Card>

            {/* Tabs */}
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-slate-900/50">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="provenance">Provenance</TabsTrigger>
                <TabsTrigger value="technical">Technical</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="mt-4">
                <Card className="p-6 bg-slate-900/50 border-slate-800">
                  <h3 className="text-lg font-semibold text-white mb-4">NFT Information</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <div className="text-sm text-slate-400 mb-1">Contract Address</div>
                      <div className="flex items-center gap-2">
                        <code className="text-sm text-cyan-400 bg-slate-800 px-3 py-1 rounded">
                          {nft.contractAddress}
                        </code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(nft.contractAddress)}
                        >
                          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    <div>
                      <div className="text-sm text-slate-400 mb-1">Token ID</div>
                      <code className="text-sm text-white bg-slate-800 px-3 py-1 rounded">
                        {nft.tokenId}
                      </code>
                    </div>

                    {nft.tbaAddress && (
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Wallet className="h-4 w-4 text-slate-400" />
                          <div className="text-sm text-slate-400">Token Bound Account (TBA)</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="text-sm text-cyan-400 bg-slate-800 px-3 py-1 rounded">
                            {nft.tbaAddress}
                          </code>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(nft.tbaAddress!)}
                          >
                            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                          This NFT has its own smart contract account that can receive royalties
                        </p>
                      </div>
                    )}

                    <div>
                      <div className="text-sm text-slate-400 mb-1">Asset URL</div>
                      <a
                        href={nft.assetUrl || undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                      >
                        View on S3 <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>

                    {nft.metadataUrl && (
                      <div>
                        <div className="text-sm text-slate-400 mb-1">Metadata URL</div>
                        <a
                          href={nft.metadataUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                        >
                          View on IPFS <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="provenance" className="mt-4">
                <Card className="p-6 bg-slate-900/50 border-slate-800">
                  <div className="flex items-center gap-2 mb-4">
                    <GitBranch className="h-5 w-5 text-cyan-400" />
                    <h3 className="text-lg font-semibold text-white">Memory Lineage</h3>
                  </div>

                  {provenance && Array.isArray(provenance) && provenance.length > 0 ? (
                    <div className="space-y-4">
                      {(provenance as any[]).map((edge: any, idx: number) => (
                        <div key={idx} className="flex items-start gap-4 p-4 bg-slate-800/50 rounded-lg">
                          <div className="flex-shrink-0 mt-1">
                            <div className="h-8 w-8 rounded-full bg-cyan-500/20 flex items-center justify-center">
                              <GitBranch className="h-4 w-4 text-cyan-400" />
                            </div>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-white font-medium">Parent Memory</span>
                              <Badge variant="outline">{edge.derivationType}</Badge>
                            </div>
                            <Link href={`/memory/${edge.parentNftId}`}>
                              <Button variant="link" className="p-0 h-auto text-cyan-400 hover:text-cyan-300">
                                {edge.parentNftId}
                              </Button>
                            </Link>
                            <div className="mt-2 text-sm text-slate-400">
                              Contribution: {edge.contributionPercent}% • Royalty: {edge.royaltyPercent}%
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-400">
                      <Info className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>This is an original memory with no parent lineage</p>
                    </div>
                  )}
                </Card>
              </TabsContent>

              <TabsContent value="technical" className="mt-4">
                <Card className="p-6 bg-slate-900/50 border-slate-800">
                  <h3 className="text-lg font-semibold text-white mb-4">Technical Specifications</h3>
                  
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Memory Type</span>
                      <span className="text-white">{nft.memoryType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Epsilon (Alignment Loss)</span>
                      <span className="text-white">{nft.epsilon}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Quality Grade</span>
                      <span className="text-white">{nft.qualityGrade}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Certification</span>
                      <span className="text-white">{nft.certification?.toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Minted At</span>
                      <span className="text-white">
                        {new Date(nft.mintedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Purchase Card */}
            <Card className="p-6 bg-slate-900/50 border-slate-800">
              <div className="text-center mb-6">
                <div className="text-3xl font-bold text-white mb-2">
                  {nft.price ? `$${nft.price}` : 'Not for sale'}
                </div>
                {nft.price && (
                  <div className="text-sm text-slate-400">≈ 0.5 ETH</div>
                )}
              </div>

              <Button
                className="w-full bg-cyan-500 hover:bg-cyan-600 text-white"
                size="lg"
                onClick={() => purchaseMutation.mutate({ nftId })}
                disabled={!nft.price || purchaseMutation.isPending}
              >
                <ShoppingCart className="mr-2 h-5 w-5" />
                {purchaseMutation.isPending ? 'Processing...' : 'Purchase Memory'}
              </Button>

              {(nft as any).hasProvenance && (
                <Link href={`/memory-provenance/${nftId}`}>
                  <Button
                    className="w-full mt-3 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
                    size="lg"
                    variant="outline"
                  >
                    <GitBranch className="mr-2 h-5 w-5" />
                    View Provenance Tree
                  </Button>
                </Link>
              )}

              <div className="mt-4 text-xs text-slate-400 text-center">
                Secure payment powered by Stripe
              </div>
            </Card>

            {/* Creator Card */}
            {creatorScore && (
              <Card className="p-6 bg-slate-900/50 border-slate-800">
                <div className="flex items-center gap-2 mb-4">
                  <Award className="h-5 w-5 text-cyan-400" />
                  <h3 className="text-lg font-semibold text-white">Creator</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-slate-400 mb-1">Agent Name</div>
                    <div className="text-white font-medium">
                      {creatorScore.agentName || 'Anonymous Agent'}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-slate-400 mb-1">Credit Score</div>
                    <div className="flex items-center gap-2">
                      <div className={`text-2xl font-bold ${getCreditGradeColor(creatorScore.creditGrade)}`}>
                        {creatorScore.creditGrade}
                      </div>
                      <div className="text-white">{creatorScore.creditScore}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-slate-400">Avg Epsilon</div>
                      <div className="text-white font-medium">{creatorScore.avgEpsilon}%</div>
                    </div>
                    <div>
                      <div className="text-slate-400">Memories</div>
                      <div className="text-white font-medium">{creatorScore.totalMemoriesCreated}</div>
                    </div>
                    <div>
                      <div className="text-slate-400">Sales</div>
                      <div className="text-white font-medium">{creatorScore.totalMemoriesSold}</div>
                    </div>
                    <div>
                      <div className="text-slate-400">Reviews</div>
                      <div className="text-white font-medium">
                        {creatorScore.positiveReviews}/{creatorScore.positiveReviews + creatorScore.negativeReviews}
                      </div>
                    </div>
                  </div>

                  <Link href={`/agents/${nft.owner}`}>
                    <Button variant="outline" className="w-full">
                      View Profile
                    </Button>
                  </Link>
                </div>
              </Card>
            )}

            {/* Stats Card */}
            <Card className="p-6 bg-slate-900/50 border-slate-800">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-5 w-5 text-cyan-400" />
                <h3 className="text-lg font-semibold text-white">Statistics</h3>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Views</span>
                  <span className="text-white">1,234</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Favorites</span>
                  <span className="text-white">89</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Downloads</span>
                  <span className="text-white">45</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
