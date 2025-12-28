import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Sparkles, AlertCircle } from "lucide-react";
import axios from "axios";

interface TrialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vectorId: number;
  vectorTitle: string;
}

export function TrialDialog({ open, onOpenChange, vectorId, vectorTitle }: TrialDialogProps) {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingCalls, setRemainingCalls] = useState<number | null>(null);
  const [totalCalls, setTotalCalls] = useState<number | null>(null);

  // Fetch remaining trial calls when dialog opens
  useEffect(() => {
    if (open) {
      fetchRemainingCalls();
      setOutput(null);
      setError(null);
      setInput("");
    }
  }, [open, vectorId]);

  const fetchRemainingCalls = async () => {
    try {
      const response = await axios.get(`/api/trial/remaining/${vectorId}`);
      setRemainingCalls(response.data.remainingCalls);
      setTotalCalls(response.data.totalTrialCalls);
    } catch (err: any) {
      console.error("Failed to fetch trial status:", err);
      setError(err.response?.data?.error || "Failed to check trial status");
    }
  };

  const handleTry = async () => {
    if (!input.trim()) {
      setError("Please enter some input data");
      return;
    }

    setLoading(true);
    setError(null);
    setOutput(null);

    try {
      const response = await axios.post("/api/trial/execute", {
        vectorId,
        input: { query: input },
      });

      setOutput(response.data.output);
      setRemainingCalls(response.data.remainingCalls);
    } catch (err: any) {
      console.error("Trial execution failed:", err);
      setError(err.response?.data?.error || err.response?.data?.message || "Trial execution failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-500" />
            Try {vectorTitle}
          </DialogTitle>
          <DialogDescription>
            Test this AI capability for free before purchasing.
            {remainingCalls !== null && totalCalls !== null && (
              <span className="block mt-2 text-sm font-medium">
                {remainingCalls} of {totalCalls} free trials remaining
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {remainingCalls === 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You've used all your free trials for this vector. Purchase to continue using it.
              </AlertDescription>
            </Alert>
          )}

          <div>
            <label className="text-sm font-medium mb-2 block">Input Data</label>
            <Textarea
              placeholder="Enter your test input here..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={4}
              disabled={loading || remainingCalls === 0}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Example: "Analyze the sentiment of this text" or "Generate a summary"
            </p>
          </div>

          {output && (
            <div>
              <label className="text-sm font-medium mb-2 block">Output</label>
              <div className="bg-muted p-4 rounded-lg">
                <pre className="text-sm whitespace-pre-wrap">
                  {JSON.stringify(output, null, 2)}
                </pre>
              </div>
              <Alert className="mt-2">
                <AlertDescription className="text-xs">
                  💡 This is a trial response. Purchase the vector for full functionality and production use.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            onClick={handleTry}
            disabled={loading || remainingCalls === 0 || !input.trim()}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Executing...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Try It Free
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
