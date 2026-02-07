import { useState } from "react";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Copy, Terminal, Key, Code, Rocket, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const steps = [
  {
    id: 1,
    title: "Generate API Key",
    description: "Create your first API key to authenticate requests",
    icon: Key,
    content: (
      <div className="space-y-4">
        <p>Navigate to the API Keys page to generate your first key:</p>
        <ol className="list-decimal list-inside space-y-2 ml-4">
          <li>Click on your profile menu (top right)</li>
          <li>Select "API Keys"</li>
          <li>Click "Generate New API Key"</li>
          <li>Give it a name (e.g., "Development Key")</li>
          <li>Copy and save your key securely</li>
        </ol>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            <strong>Important:</strong> API keys are shown only once. Make sure to copy and store them securely.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 2,
    title: "Install Python SDK",
    description: "Set up the awareness-sdk package",
    icon: Terminal,
    content: (
      <div className="space-y-4">
        <p>Install the official Python SDK using pip:</p>
        <CodeBlock
          code="pip install awareness-sdk"
          language="bash"
        />
        <p>Or with a specific version:</p>
        <CodeBlock
          code="pip install awareness-sdk==1.0.0"
          language="bash"
        />
      </div>
    ),
  },
  {
    id: 3,
    title: "Initialize Client",
    description: "Connect to the Awareness API",
    icon: Code,
    content: (
      <div className="space-y-4">
        <p>Create a client instance with your API key:</p>
        <CodeBlock
          code={`from awareness_sdk import AwarenessClient

# Initialize the client
client = AwarenessClient(
    api_key="your-api-key-here",
    base_url="http://localhost:8080"  # Memory Exchange
)

# Test the connection
print("Client initialized successfully!")`}
          language="python"
        />
      </div>
    ),
  },
  {
    id: 4,
    title: "Make Your First API Call",
    description: "Store and retrieve a reasoning chain",
    icon: Rocket,
    content: (
      <div className="space-y-4">
        <p>Store a reasoning chain in Memory Exchange:</p>
        <CodeBlock
          code={`# Store a reasoning chain
chain_id = client.memory_exchange.store_reasoning_chain(
    agent_id="agent_001",
    chain_data={
        "steps": [
            {"action": "analyze", "result": "Task decomposed"},
            {"action": "execute", "result": "Solution found"}
        ],
        "metadata": {"complexity": "medium"}
    }
)

print(f"Chain stored with ID: {chain_id}")

# Retrieve the chain
chain = client.memory_exchange.get_reasoning_chain(chain_id)
print(f"Retrieved chain: {chain}")`}
          language="python"
        />
        <p className="mt-4">Get personalized recommendations:</p>
        <CodeBlock
          code={`# Get recommendations
recommendations = client.get_recommendations(
    user_id="user_123",
    limit=5
)

for rec in recommendations:
    print(f"{rec['title']} (Score: {rec['score']})")`}
          language="python"
        />
      </div>
    ),
  },
];

function CodeBlock({ code, language }: { code: string; language: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast({
      title: "Copied!",
      description: "Code copied to clipboard",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative">
      <div className="absolute top-2 right-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={copyToClipboard}
          className="h-8 w-8 p-0"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
      <pre className="bg-slate-950 text-slate-50 p-4 rounded-lg overflow-x-auto">
        <code className={`language-${language}`}>{code}</code>
      </pre>
    </div>
  );
}

export default function DeveloperOnboarding() {
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const currentStepData = steps.find((s) => s.id === currentStep);

  const markComplete = () => {
    if (!completedSteps.includes(currentStep)) {
      setCompletedSteps([...completedSteps, currentStep]);
    }
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goToStep = (stepId: number) => {
    setCurrentStep(stepId);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      <div className="container mx-auto py-8 max-w-6xl mt-20">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Developer Onboarding</h1>
        <p className="text-muted-foreground">
          Get started with the Awareness API in 4 simple steps
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Step Navigator */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Progress</CardTitle>
              <CardDescription>
                {completedSteps.length} of {steps.length} completed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {steps.map((step) => {
                const Icon = step.icon;
                const isCompleted = completedSteps.includes(step.id);
                const isCurrent = currentStep === step.id;

                return (
                  <button
                    key={step.id}
                    onClick={() => goToStep(step.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${
                      isCurrent
                        ? "bg-primary text-primary-foreground"
                        : isCompleted
                        ? "bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30"
                        : "hover:bg-muted"
                    }`}
                  >
                    <div
                      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        isCurrent
                          ? "bg-primary-foreground text-primary"
                          : isCompleted
                          ? "bg-green-500 text-white"
                          : "bg-muted"
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Icon className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{step.title}</div>
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* Quick Links */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-lg">Quick Links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <a
                href="/api-keys"
                className="block text-sm text-primary hover:underline"
              >
                �?API Keys
              </a>
              <a
                href="/service-health"
                className="block text-sm text-primary hover:underline"
              >
                �?Service Status
              </a>
              <a
                href="https://pypi.org/project/awareness-sdk/"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-primary hover:underline"
              >
                �?Python SDK on PyPI �?
              </a>
            </CardContent>
          </Card>
        </div>

        {/* Step Content */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                {currentStepData && (
                  <>
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <currentStepData.icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle>{currentStepData.title}</CardTitle>
                        {completedSteps.includes(currentStep) && (
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            <Check className="h-3 w-3 mr-1" />
                            Completed
                          </Badge>
                        )}
                      </div>
                      <CardDescription>{currentStepData.description}</CardDescription>
                    </div>
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="prose dark:prose-invert max-w-none">
                {currentStepData?.content}
              </div>

              <div className="flex justify-between mt-8 pt-6 border-t">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
                  disabled={currentStep === 1}
                >
                  Previous
                </Button>
                <Button onClick={markComplete}>
                  {currentStep === steps.length ? "Finish" : "Next Step"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* All Steps Completed */}
          {completedSteps.length === steps.length && (
            <Card className="mt-6 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-800 dark:text-green-200">
                  <Check className="h-5 w-5" />
                  Congratulations!
                </CardTitle>
                <CardDescription className="text-green-700 dark:text-green-300">
                  You've completed the onboarding tutorial
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-green-800 dark:text-green-200 mb-4">
                  You're now ready to build amazing AI applications with the Awareness API!
                </p>
                <div className="flex gap-3">
                  <Button asChild>
                    <a href="/dashboard">Go to Dashboard</a>
                  </Button>
                  <Button variant="outline" asChild>
                    <a href="/service-health">View Services</a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
