import { useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, ArrowRight, Package } from "lucide-react";
import { toast } from "sonner";

export default function PurchaseSuccess() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(search);
  const transactionId = params.get("transactionId");

  useEffect(() => {
    toast.success("Purchase Successful!", {
      description: "Your AI capability is now available in your dashboard.",
    });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="pt-20 container mx-auto px-4 py-16">
        <div className="flex items-center justify-center">
          <Card className="w-full max-w-2xl">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle className="text-3xl">Payment Successful!</CardTitle>
              <CardDescription className="text-lg">
                Thank you for your purchase. Your AI capability is now ready to use.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {transactionId && (
                <div className="rounded-lg border bg-muted/50 p-4">
                  <div className="text-sm text-muted-foreground">Transaction ID</div>
                  <div className="font-mono text-sm">{transactionId}</div>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600" />
                  <div>
                    <div className="font-medium">Instant Access</div>
                    <div className="text-sm text-muted-foreground">
                      Your AI capability is immediately available
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600" />
                  <div>
                    <div className="font-medium">API Integration</div>
                    <div className="text-sm text-muted-foreground">
                      Use our API or SDK to integrate into your applications
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600" />
                  <div>
                    <div className="font-medium">Email Confirmation</div>
                    <div className="text-sm text-muted-foreground">
                      Check your email for receipt and access details
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-4 sm:flex-row">
                <Button
                  onClick={() => setLocation("/dashboard")}
                  className="flex-1"
                  size="lg"
                >
                  <Package className="mr-2 h-5 w-5" />
                  View My Capabilities
                </Button>
                <Button
                  onClick={() => setLocation("/marketplace")}
                  variant="outline"
                  className="flex-1"
                  size="lg"
                >
                  Continue Shopping
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>

              <div className="rounded-lg border-l-4 border-blue-500 bg-blue-50 p-4 dark:bg-blue-950/30">
                <div className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Need help getting started?
                </div>
                <div className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                  Check out our{" "}
                  <a href="/documentation" className="underline hover:no-underline">
                    documentation
                  </a>{" "}
                  for integration guides.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
