import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Copy, Check, Play, Code2, Terminal, FileCode } from 'lucide-react';
import { toast } from 'sonner';

interface ApiTutorialProps {
  apiKey?: string;
}

export function ApiTutorial({ apiKey: initialApiKey }: ApiTutorialProps) {
  const [apiKey, setApiKey] = useState(initialApiKey || 'your_api_key_here');
  const [testEndpoint, setTestEndpoint] = useState('/api/vectors');
  const [testResponse, setTestResponse] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const baseUrl = window.location.origin;

  const handleCopyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    toast.success('Code copied to clipboard');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleTestApi = async () => {
    if (apiKey === 'your_api_key_here') {
      toast.error('Please enter a valid API key');
      return;
    }

    setTestLoading(true);
    setTestResponse(null);

    try {
      const response = await fetch(`${baseUrl}${testEndpoint}`, {
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      setTestResponse(JSON.stringify(data, null, 2));
      
      if (response.ok) {
        toast.success('API request successful');
      } else {
        toast.error(`API request failed: ${response.status}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setTestResponse(`Error: ${errorMessage}`);
      toast.error('API request failed');
    } finally {
      setTestLoading(false);
    }
  };

  const curlExample = `curl ${baseUrl}/api/vectors \\
  -H "X-API-Key: ${apiKey}" \\
  -H "Content-Type: application/json"`;

  const pythonExample = `from awareness_network_sdk import AwarenessClient

# Initialize client
client = AwarenessClient(
    api_key="${apiKey}",
    base_url="${baseUrl}"
)

# List available vectors
vectors = client.vectors.list()
print(f"Found {len(vectors)} vectors")

# Get vector details
vector = client.vectors.get(vector_id=1)
print(f"Vector: {vector.name}")

# Purchase a vector
purchase = client.vectors.purchase(
    vector_id=1,
    pricing_tier="per-call"
)
print(f"Purchase successful: {purchase.access_token}")

# Invoke a vector
result = client.vectors.invoke(
    vector_id=1,
    input_data={"text": "Hello, world!"}
)
print(f"Result: {result}")`;

  const javascriptExample = `// Using fetch API
const apiKey = "${apiKey}";
const baseUrl = "${baseUrl}";

// List available vectors
async function listVectors() {
  const response = await fetch(\`\${baseUrl}/api/vectors\`, {
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json'
    }
  });
  
  const data = await response.json();
  console.log('Vectors:', data);
  return data;
}

// Purchase a vector
async function purchaseVector(vectorId) {
  const response = await fetch(\`\${baseUrl}/api/vectors/purchase\`, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      vectorId: vectorId,
      pricingTier: 'per-call'
    })
  });
  
  const data = await response.json();
  console.log('Purchase result:', data);
  return data;
}

// Invoke a vector
async function invokeVector(vectorId, inputData) {
  const response = await fetch(\`\${baseUrl}/api/vectors/invoke\`, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      vectorId: vectorId,
      inputData: inputData
    })
  });
  
  const data = await response.json();
  console.log('Invocation result:', data);
  return data;
}

// Example usage
listVectors()
  .then(vectors => console.log(\`Found \${vectors.length} vectors\`))
  .catch(error => console.error('Error:', error));`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">API Tutorial</h2>
        <p className="text-muted-foreground">
          Learn how to integrate Awareness Network API into your applications
        </p>
      </div>

      {/* API Key Input */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your API Key</CardTitle>
          <CardDescription>
            Enter your API key to see personalized code examples
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="ak_live_..."
              className="font-mono text-sm"
            />
            {apiKey !== 'your_api_key_here' && (
              <Badge variant="default">Connected</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Code Examples */}
      <Tabs defaultValue="curl" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="curl">
            <Terminal className="h-4 w-4 mr-2" />
            cURL
          </TabsTrigger>
          <TabsTrigger value="python">
            <Code2 className="h-4 w-4 mr-2" />
            Python
          </TabsTrigger>
          <TabsTrigger value="javascript">
            <FileCode className="h-4 w-4 mr-2" />
            JavaScript
          </TabsTrigger>
        </TabsList>

        <TabsContent value="curl">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">cURL Example</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyCode(curlExample, 'curl')}
                >
                  {copiedCode === 'curl' ? (
                    <Check className="h-4 w-4 mr-2 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4 mr-2" />
                  )}
                  Copy
                </Button>
              </div>
              <CardDescription>
                Use cURL to make API requests from the command line
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
                <code>{curlExample}</code>
              </pre>
              <div className="mt-4">
                <h4 className="font-semibold mb-2">Common Endpoints:</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li><code className="bg-muted px-1 py-0.5 rounded">GET /api/vectors</code> - List all vectors</li>
                  <li><code className="bg-muted px-1 py-0.5 rounded">GET /api/vectors/:id</code> - Get vector details</li>
                  <li><code className="bg-muted px-1 py-0.5 rounded">POST /api/vectors/purchase</code> - Purchase a vector</li>
                  <li><code className="bg-muted px-1 py-0.5 rounded">POST /api/vectors/invoke</code> - Invoke a vector</li>
                  <li><code className="bg-muted px-1 py-0.5 rounded">POST /api/neural-bridge/align</code> - Align vectors</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="python">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Python SDK Example</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyCode(pythonExample, 'python')}
                >
                  {copiedCode === 'python' ? (
                    <Check className="h-4 w-4 mr-2 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4 mr-2" />
                  )}
                  Copy
                </Button>
              </div>
              <CardDescription>
                Use our Python SDK for easy integration
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="mb-4">
                <AlertDescription>
                  <strong>Installation:</strong> <code className="bg-muted px-1 py-0.5 rounded">pip install awareness-network-sdk</code>
                  <br />
                  <a href="/sdk/python/README.md" target="_blank" className="text-primary hover:underline text-sm">
                    View full Python SDK documentation �?
                  </a>
                </AlertDescription>
              </Alert>
              <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
                <code>{pythonExample}</code>
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="javascript">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">JavaScript Example</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyCode(javascriptExample, 'javascript')}
                >
                  {copiedCode === 'javascript' ? (
                    <Check className="h-4 w-4 mr-2 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4 mr-2" />
                  )}
                  Copy
                </Button>
              </div>
              <CardDescription>
                Use the Fetch API or Axios in Node.js or browser
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
                <code>{javascriptExample}</code>
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Live API Tester */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Live API Tester</CardTitle>
          <CardDescription>
            Test API endpoints in real-time with your API key
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="endpoint">Endpoint</Label>
            <div className="flex gap-2">
              <Input
                id="endpoint"
                value={testEndpoint}
                onChange={(e) => setTestEndpoint(e.target.value)}
                placeholder="/api/vectors"
                className="font-mono text-sm"
              />
              <Button
                onClick={handleTestApi}
                disabled={testLoading || apiKey === 'your_api_key_here'}
              >
                {testLoading ? (
                  'Testing...'
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Test
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Full URL: <code className="bg-muted px-1 py-0.5 rounded">{baseUrl}{testEndpoint}</code>
            </p>
          </div>

          {testResponse && (
            <div className="space-y-2">
              <Label>Response</Label>
              <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm max-h-64">
                <code>{testResponse}</code>
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Additional Resources */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Additional Resources</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li>
              <a href="/docs/AI_QUICK_START.md" target="_blank" className="text-primary hover:underline">
                AI Quick Start Guide �?
              </a>
            </li>
            <li>
              <a href="/api-docs" target="_blank" className="text-primary hover:underline">
                Full API Reference (Swagger UI) �?
              </a>
            </li>
            <li>
              <a href="/docs/WHITEPAPER.md" target="_blank" className="text-primary hover:underline">
                Neural Bridge Protocol Whitepaper �?
              </a>
            </li>
            <li>
              <a href="https://github.com/everest-an/Awareness-Market" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                GitHub Repository �?
              </a>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
