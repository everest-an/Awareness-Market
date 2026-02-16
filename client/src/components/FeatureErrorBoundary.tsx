import { Component, ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
  feature: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Feature-scoped error boundary for v3 pages.
 * Shows a contained error card instead of crashing the whole app.
 */
export class FeatureErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[${this.props.feature}] Error boundary caught:`, error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="container mx-auto py-12 px-4 max-w-2xl">
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                {this.props.feature} Error
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Something went wrong loading this section. This has been logged.
              </p>

              {this.state.error && (
                <pre className="p-3 rounded bg-muted text-xs overflow-auto max-h-32">
                  {this.state.error.message}
                </pre>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.history.back()}
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Go Back
                </Button>
                <Button
                  size="sm"
                  onClick={() => this.setState({ hasError: false, error: null })}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Retry
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
