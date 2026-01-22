import { useParams, Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect, useState } from "react";
import { PurchaseDialog } from "@/components/PurchaseDialog";
import { TrialDialog } from "@/components/TrialDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  Star, 
  DollarSign, 
  TrendingUp, 
  Brain, 
  Shield, 
  Zap,
  ChevronLeft,
  ShoppingCart,
  Download,
  BarChart3,
  MessageSquare
} from "lucide-react";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";

export default function VectorDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [trialDialogOpen, setTrialDialogOpen] = useState(false);
  
  const vectorId = parseInt(id || "0");

  // Track view for recommendations
  const trackViewMutation = trpc.recommendations.trackView.useMutation();

  useEffect(() => {
    if (isAuthenticated && vectorId) {
      trackViewMutation.mutate({ vectorId });
    }
  }, [vectorId, isAuthenticated]);
  
  const { data: vector, isLoading } = trpc.vectors.getById.useQuery(
    { id: vectorId },
    { enabled: !!vectorId }
  );
  
  const { data: reviews } = trpc.reviews.getByVector.useQuery(
    { vectorId },
    { enabled: !!vectorId }
  );

  const handlePurchaseClick = () => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    setPurchaseDialogOpen(true);
  };

  const handlePurchaseSuccess = () => {
    toast.success("Purchase successful!");
    setLocation("/dashboard/consumer");
  };

  const handleTrialClick = () => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    setTrialDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container py-8">
          <Skeleton className="mb-8 h-10 w-32" />
          <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
            <div className="space-y-6">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!vector) {
    return (
      <div className="container py-16 text-center">
        <h2 className="mb-4 text-2xl font-bold">AI Capability Not Found</h2>
        <p className="mb-6 text-muted-foreground">
          The AI capability you're looking for doesn't exist or has been removed.
        </p>
        <Button asChild>
          <Link href="/marketplace">Back to Marketplace</Link>
        </Button>
      </div>
    );
  }

  const rating = parseFloat(vector.averageRating || "0");
  const isOwner = user?.id === vector.creatorId;
  const metrics = (() => {
    try {
      return vector.performanceMetrics ? JSON.parse(vector.performanceMetrics) : {};
    } catch {
      return {};
    }
  })();
  const accuracy = metrics.accuracy ?? metrics.accuracy_score ?? 0;
  const latency = metrics.latency ?? metrics.latency_ms ?? metrics.latencyMs ?? null;
  const throughput = metrics.throughput ?? metrics.throughput_qps ?? metrics.throughputQps ?? null;

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8">
        {/* Back Button */}
        <Button variant="ghost" asChild className="mb-6">
          <Link href="/marketplace">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Marketplace
          </Link>
        </Button>

        <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
          {/* Main Content */}
          <div className="space-y-6">
            {/* Header */}
            <Card>
              <CardHeader>
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{vector.category}</Badge>
                  {vector.status === "active" ? (
                    <Badge variant="default">Active</Badge>
                  ) : (
                    <Badge variant="outline">Inactive</Badge>
                  )}
                </div>
                <CardTitle className="text-3xl">{vector.title}</CardTitle>
                <CardDescription className="text-base">
                  {vector.description}
                </CardDescription>
                
                <div className="mt-4 flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                    <span className="text-lg font-semibold">{rating.toFixed(1)}</span>
                    <span className="text-muted-foreground">
                      ({vector.reviewCount} reviews)
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <TrendingUp className="h-5 w-5" />
                    <span>{vector.totalCalls} total calls</span>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Tabs */}
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="performance">Performance</TabsTrigger>
                <TabsTrigger value="reviews">Reviews</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Technical Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {vector.modelArchitecture && (
                      <div className="flex items-start gap-3">
                        <Brain className="mt-1 h-5 w-5 text-primary" />
                        <div>
                          <div className="font-medium">Model Architecture</div>
                          <div className="text-sm text-muted-foreground">
                            {vector.modelArchitecture}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-start gap-3">
                      <Zap className="mt-1 h-5 w-5 text-accent" />
                      <div>
                        <div className="font-medium">Vector Dimensions</div>
                        <div className="text-sm text-muted-foreground">
                          {vector.vectorDimension || "N/A"}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <Shield className="mt-1 h-5 w-5 text-primary" />
                      <div>
                        <div className="font-medium">Compression Format</div>
                        <div className="text-sm text-muted-foreground">
                          Standard
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>


              </TabsContent>

              <TabsContent value="performance" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Performance Metrics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <div className="mb-2 flex justify-between text-sm">
                        <span>Accuracy Score</span>
                        <span className="font-medium">
                          {accuracy ? `${(accuracy * 100).toFixed(1)}%` : "N/A"}
                        </span>
                      </div>
                      <Progress value={accuracy ? accuracy * 100 : 0} />
                    </div>
                    
                    <div>
                      <div className="mb-2 flex justify-between text-sm">
                        <span>Average Latency</span>
                        <span className="font-medium">
                          {latency ? `~${latency}ms` : "N/A"}
                        </span>
                      </div>
                    </div>
                    
                    <div>
                      <div className="mb-2 flex justify-between text-sm">
                        <span>Throughput</span>
                        <span className="font-medium">
                          {throughput ? `${throughput} QPS` : "N/A"}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Usage Statistics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Total API Calls</span>
                      <span className="text-2xl font-bold">{vector.totalCalls}</span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Active Users</span>
                      <span className="text-2xl font-bold">
                        {Math.floor(vector.totalCalls / 100)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="reviews" className="space-y-4">
                {reviews && reviews.length > 0 ? (
                  reviews.map((review: any) => (
                    <Card key={review.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarFallback>
                                {review.reviewerName?.[0]?.toUpperCase() || "U"}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{review.reviewerName || "Anonymous"}</div>
                              <div className="flex items-center gap-2">
                                <div className="flex">
                                  {Array.from({ length: 5 }).map((_, i) => (
                                    <Star
                                      key={i}
                                      className={`h-4 w-4 ${
                                        i < review.rating
                                          ? "fill-yellow-400 text-yellow-400"
                                          : "text-gray-300"
                                      }`}
                                    />
                                  ))}
                                </div>
                                {review.isVerifiedPurchase && (
                                  <Badge variant="secondary" className="text-xs">
                                    Verified Purchase
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {new Date(review.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </CardHeader>
                      {review.comment && (
                        <CardContent>
                          <p className="text-muted-foreground">{review.comment}</p>
                        </CardContent>
                      )}
                    </Card>
                  ))
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <MessageSquare className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                      <h3 className="mb-2 font-semibold">No reviews yet</h3>
                      <p className="text-sm text-muted-foreground">
                        Be the first to review this AI capability
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Pricing Card */}
            <Card>
              <CardHeader>
                <CardTitle>Pricing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-baseline gap-2">
                  <DollarSign className="h-6 w-6 text-primary" />
                  <span className="text-4xl font-bold">
                    {parseFloat(vector.basePrice).toFixed(2)}
                  </span>
                  <span className="text-muted-foreground">
                    /{vector.pricingModel === "per-call" ? "call" : "month"}
                  </span>
                </div>
                
                <Separator />
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pricing Model</span>
                    <span className="font-medium capitalize">{vector.pricingModel}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Platform Fee</span>
                    <span className="font-medium">20%</span>
                  </div>
                </div>
                
                <Separator />
                
                {isOwner ? (
                  <Button className="w-full" disabled>
                    You Own This Capability
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <Button 
                      variant="outline"
                      className="w-full" 
                      size="lg"
                      onClick={handleTrialClick}
                      disabled={vector.status !== "active"}
                    >
                      <Zap className="mr-2 h-5 w-5" />
                      Try It Free
                    </Button>
                    <Button 
                      className="w-full" 
                      size="lg"
                      onClick={handlePurchaseClick}
                      disabled={vector.status !== "active"}
                    >
                      <ShoppingCart className="mr-2 h-5 w-5" />
                      Purchase Access
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Features Card */}
            <Card>
              <CardHeader>
                <CardTitle>What's Included</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <Download className="mt-1 h-4 w-4 text-primary" />
                  <div className="text-sm">
                    <div className="font-medium">Instant Access</div>
                    <div className="text-muted-foreground">
                      Download vectors immediately after purchase
                    </div>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Shield className="mt-1 h-4 w-4 text-primary" />
                  <div className="text-sm">
                    <div className="font-medium">Secure Integration</div>
                    <div className="text-muted-foreground">
                      Encrypted transmission with access tokens
                    </div>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <BarChart3 className="mt-1 h-4 w-4 text-primary" />
                  <div className="text-sm">
                    <div className="font-medium">Usage Analytics</div>
                    <div className="text-muted-foreground">
                      Track performance and API calls
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Creator Info */}
            <Card>
              <CardHeader>
                <CardTitle>Creator</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback>
                      C
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">Creator #{vector.creatorId}</div>
                    <div className="text-sm text-muted-foreground">
                      {vector.totalCalls > 1000 ? "Verified Creator" : "New Creator"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Purchase Dialog */}
      {vector && (
        <>
          <PurchaseDialog
            vector={vector}
            open={purchaseDialogOpen}
            onOpenChange={setPurchaseDialogOpen}
            onSuccess={handlePurchaseSuccess}
          />
          <TrialDialog
            open={trialDialogOpen}
            onOpenChange={setTrialDialogOpen}
            vectorId={vector.id}
            vectorTitle={vector.title}
          />
        </>
      )}
    </div>
  );
}
