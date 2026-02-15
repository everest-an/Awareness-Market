import { useState } from "react";
import Navbar from "@/components/Navbar";
import { WorkflowVisualizer } from "@/components/WorkflowVisualizer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play, Zap, Package, Brain } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";

export default function WorkflowDemo() {
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null);
  const { toast } = useToast();

  const startDemoWorkflow = trpc.workflow.startDemo.useMutation({
    onSuccess: (data) => {
      setActiveWorkflowId(data.workflowId);
      toast({
        title: "Workflow Started",
        description: "Demo workflow is now running. Watch the visualization below!",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const demoScenarios: {
    id: "ai_reasoning" | "memory_transfer" | "package_processing";
    title: string;
    description: string;
    icon: typeof Brain;
    color: string;
  }[] = [
    {
      id: "ai_reasoning",
      title: "AI Reasoning Chain",
      description: "Watch an AI agent solve a complex problem step-by-step",
      icon: Brain,
      color: "bg-blue-500",
    },
    {
      id: "memory_transfer",
      title: "Memory Transfer",
      description: "See KV-Cache and W-Matrix transformation in action",
      icon: Zap,
      color: "bg-purple-500",
    },
    {
      id: "package_processing",
      title: "Package Processing",
      description: "Track the upload and validation of a Vector Package",
      icon: Package,
      color: "bg-green-500",
    },
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      <div className="pt-20 container mx-auto py-8 space-y-8 mt-20">
        {/* Header */}
        <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">Workflow Visualizer Demo</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Experience real-time visualization of AI reasoning, memory transfer, and package processing workflows
        </p>
      </div>

      {/* Demo Scenarios */}
      {!activeWorkflowId && (
        <div className="grid md:grid-cols-3 gap-6">
          {demoScenarios.map((scenario) => {
            const Icon = scenario.icon;
            return (
              <Card key={scenario.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className={`w-12 h-12 rounded-lg ${scenario.color} flex items-center justify-center mb-4`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle>{scenario.title}</CardTitle>
                  <CardDescription>{scenario.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    className="w-full"
                    onClick={() => startDemoWorkflow.mutate({ scenario: scenario.id })}
                    disabled={startDemoWorkflow.isPending}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Start Demo
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Workflow Visualizer */}
      {activeWorkflowId && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="default">Live Demo</Badge>
              <span className="text-sm text-muted-foreground">
                Workflow ID: {activeWorkflowId}
              </span>
            </div>
            <Button
              variant="outline"
              onClick={() => setActiveWorkflowId(null)}
            >
              Close Visualizer
            </Button>
          </div>

          <WorkflowVisualizer
            workflowId={activeWorkflowId}
            title="Demo Workflow"
            onClose={() => setActiveWorkflowId(null)}
          />
        </div>
      )}

      {/* Features */}
      <Card>
        <CardHeader>
          <CardTitle>Features</CardTitle>
          <CardDescription>
            What you can do with the Workflow Visualizer
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-semibold">Real-time Event Timeline</h4>
              <p className="text-sm text-muted-foreground">
                See events as they happen with a horizontal timeline showing duration and relationships
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">Detailed Event Inspection</h4>
              <p className="text-sm text-muted-foreground">
                Click any event to view input, output, metadata, and error details
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">Advanced Filtering</h4>
              <p className="text-sm text-muted-foreground">
                Filter by event type, status, or search for specific events
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">Export for Debugging</h4>
              <p className="text-sm text-muted-foreground">
                Download complete workflow data as JSON for offline analysis
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Integration Examples */}
      <Card>
        <CardHeader>
          <CardTitle>Integration Examples</CardTitle>
          <CardDescription>
            Where the Workflow Visualizer is used in Awareness
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Brain className="h-5 w-5 text-blue-500 mt-1" />
              <div>
                <h4 className="font-semibold">AI Agent Reasoning</h4>
                <p className="text-sm text-muted-foreground">
                  Track LLM prompts, tool calls, and responses when AI agents solve problems
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Zap className="h-5 w-5 text-purple-500 mt-1" />
              <div>
                <h4 className="font-semibold">Memory Transfer</h4>
                <p className="text-sm text-muted-foreground">
                  Visualize KV-Cache loading, W-Matrix transformation, and cross-model memory transfer
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Package className="h-5 w-5 text-green-500 mt-1" />
              <div>
                <h4 className="font-semibold">Package Processing</h4>
                <p className="text-sm text-muted-foreground">
                  Monitor upload, validation, and processing of Vector/Memory/Chain packages
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
