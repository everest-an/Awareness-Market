import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Play, Clock, DollarSign, CheckCircle2, XCircle } from "lucide-react";

interface VectorTestPanelProps {
  vectorId: number;
  hasAccess: boolean;
  pricingModel: string;
  basePrice: string;
}

export function VectorTestPanel({ vectorId, hasAccess, pricingModel, basePrice }: VectorTestPanelProps) {
  const [inputData, setInputData] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const invokeMutation = trpc.vectors.invoke.useMutation();
  const { data: history, refetch: refetchHistory } = trpc.vectors.invocationHistory.useQuery(
    { vectorId, limit: 5 },
    { enabled: hasAccess }
  );

  const handleTest = async () => {
    if (!inputData.trim()) {
      setError("Please enter test data");
      return;
    }

    setIsExecuting(true);
    setError(null);
    setResult(null);

    try {
      const parsedInput = JSON.parse(inputData);
      const response = await invokeMutation.mutateAsync({
        vectorId,
        inputData: parsedInput,
      });

      setResult(response);
      refetchHistory();
    } catch (err: any) {
      setError(err.message || "Invocation failed");
    } finally {
      setIsExecuting(false);
    }
  };

  if (!hasAccess) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Test Vector</CardTitle>
          <CardDescription>Purchase this vector to test it</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              You need to purchase this vector to use the test feature. Price: {basePrice} ({pricingModel})
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Test Vector</CardTitle>
          <CardDescription>
            Enter JSON-formatted test data to invoke the vector and view results in real-time
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Input Data (JSON format)</label>
            <Textarea
              value={inputData}
              onChange={(e) => setInputData(e.target.value)}
              placeholder='{"prompt": "Your input data", "parameters": {...}}'
              rows={6}
              className="font-mono text-sm"
            />
          </div>

          <Button
            onClick={handleTest}
            disabled={isExecuting || !inputData.trim()}
            className="w-full"
          >
            {isExecuting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Executing...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Run Test
              </>
            )}
          </Button>

          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {result && (
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Execution Successful</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>Execution Time: {result.executionTime}ms</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span>Cost: ${result.cost}</span>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Output Result</label>
                <pre className="bg-muted p-4 rounded-lg overflow-auto text-sm font-mono max-h-64">
                  {JSON.stringify(result.output, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {history && history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Invocation History</CardTitle>
            <CardDescription>Last 5 invocation records</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {history.map((record: any) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <div className="flex-1">
                    <div className="text-sm font-medium">
                      {record.status === "success" ? (
                        <span className="text-green-600">Success</span>
                      ) : (
                        <span className="text-red-600">Failed</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(record.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div>{record.executionTime}ms</div>
                    <div className="text-muted-foreground">${record.cost}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
