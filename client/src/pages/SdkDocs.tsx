import { Card } from "@/components/ui/card";
import { Link } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Copy, Check, ExternalLink, Download } from "lucide-react";
import { useState } from "react";
import Navbar from "@/components/Navbar";

export default function SdkDocs() {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const codeBlocks = {
    install: `pip install awareness-network-sdk`,
    quickStart: `from awareness_network_sdk import AwarenessClient

client = AwarenessClient(
    base_url="https://awareness-network.com",
    api_key="ak_live_your_api_key"
)

# Discover vectors
vectors = client.discover_vectors(category="nlp")

# Purchase and invoke
purchase = client.purchase_vector(vector_id=1)
result = client.invoke_vector(
    vector_id=1,
    input_data={"text": "Analyze this"}
)

print(f"Result: {result}")`,
    async: `import asyncio
from awareness_network_async import AsyncAwarenessClient

async def main():
    client = AsyncAwarenessClient(
        base_url="https://awareness-network.com",
        api_key="ak_live_your_api_key"
    )
    
    # Concurrent operations
    vectors_task = client.discover_vectors()
    purchases_task = client.list_purchases()
    
    vectors, purchases = await asyncio.gather(
        vectors_task,
        purchases_task
    )
    
    print(f"Found {len(vectors)} vectors")
    
    await client.close()

asyncio.run(main())`,
    streaming: `async def stream_example():
    client = AsyncAwarenessClient(...)
    
    async for chunk in client.invoke_vector_stream(
        vector_id=1,
        input_data={"text": "Generate article"}
    ):
        if chunk["event"] == "progress":
            print(f"Progress: {chunk['data']['progress'] * 100}%")
        elif chunk["event"] == "data":
            print(f"Partial: {chunk['data']['text']}")
        elif chunk["event"] == "done":
            print("Complete!")
    
    await client.close()`,
    batch: `# Process multiple items efficiently
results = client.batch_invoke([
    {"vector_id": 1, "input": {"text": "Item 1"}},
    {"vector_id": 1, "input": {"text": "Item 2"}},
    {"vector_id": 2, "input": {"image_url": "https://..."}}
])

for result in results:
    if result["success"]:
        print(f"Vector {result['vector_id']}: {result['result']}")
    else:
        print(f"Error: {result['error']}")`,
    latentmas: `# Align vectors between models
aligned = client.align_vector(
    source_vector=[0.1, 0.2, 0.3, ...],
    source_model="gpt-3.5-turbo",
    target_model="bert-base"
)

print(f"Aligned: {aligned['aligned_vector']}")
print(f"Quality: {aligned['quality_score']}")

# Transform dimensions
transformed = client.transform_vector(
    vector=[0.1, 0.2, ...],
    source_dim=1536,
    target_dim=768,
    method="pca"
)

print(f"Transformed to {len(transformed['transformed_vector'])}D")`,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <Navbar />

      {/* Header */}
      <div className="pt-20 border-b border-white/5">
        <div className="container mx-auto py-8">
          <h1 className="text-4xl font-bold mb-2">Python SDK <span className="gradient-text">Documentation</span></h1>
          <p className="text-lg text-muted-foreground">
            Complete guide to integrating Awareness into your AI applications
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto py-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <Card className="p-4 sticky top-4">
              <h3 className="font-semibold mb-4">Contents</h3>
              <nav className="space-y-2">
                <a href="#installation" className="block text-sm text-muted-foreground hover:text-foreground">
                  Installation
                </a>
                <a href="#quick-start" className="block text-sm text-muted-foreground hover:text-foreground">
                  Quick Start
                </a>
                <a href="#async" className="block text-sm text-muted-foreground hover:text-foreground">
                  Async Operations
                </a>
                <a href="#streaming" className="block text-sm text-muted-foreground hover:text-foreground">
                  Streaming
                </a>
                <a href="#batch" className="block text-sm text-muted-foreground hover:text-foreground">
                  Batch Processing
                </a>
                <a href="#latentmas" className="block text-sm text-muted-foreground hover:text-foreground">
                  LatentMAS Protocol
                </a>
                <a href="#resources" className="block text-sm text-muted-foreground hover:text-foreground">
                  Resources
                </a>
              </nav>
            </Card>
          </div>

          {/* Main Documentation */}
          <div className="lg:col-span-3 space-y-8">
            {/* Installation */}
            <section id="installation">
              <Card className="p-6">
                <h2 className="text-2xl font-bold mb-4">Installation</h2>
                <p className="text-muted-foreground mb-4">
                  Install the SDK via pip. Requires Python 3.8 or higher.
                </p>
                <div className="relative">
                  <pre className="bg-slate-900 text-slate-50 p-4 rounded-lg overflow-x-auto">
                    <code>{codeBlocks.install}</code>
                  </pre>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(codeBlocks.install, 0)}
                  >
                    {copiedIndex === 0 ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="mt-4 p-4 bg-primary/10 border border-primary/20 rounded-lg">
                  <p className="text-sm text-foreground">
                    <strong>Note:</strong> For async support, install with: <code className="bg-white/10 px-2 py-1 rounded">pip install awareness-network-sdk[async]</code>
                  </p>
                </div>
              </Card>
            </section>

            {/* Quick Start */}
            <section id="quick-start">
              <Card className="p-6">
                <h2 className="text-2xl font-bold mb-4">Quick Start</h2>
                <p className="text-muted-foreground mb-4">
                  Get started with the synchronous client for simple applications.
                </p>
                <div className="relative">
                  <pre className="bg-slate-900 text-slate-50 p-4 rounded-lg overflow-x-auto text-sm">
                    <code>{codeBlocks.quickStart}</code>
                  </pre>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(codeBlocks.quickStart, 1)}
                  >
                    {copiedIndex === 1 ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </Card>
            </section>

            {/* Async Operations */}
            <section id="async">
              <Card className="p-6">
                <h2 className="text-2xl font-bold mb-4">Async Operations</h2>
                <p className="text-muted-foreground mb-4">
                  Use <code className="bg-white/10 px-2 py-1 rounded">AsyncAwarenessClient</code> for high-performance applications with concurrent operations.
                </p>
                <div className="relative">
                  <pre className="bg-slate-900 text-slate-50 p-4 rounded-lg overflow-x-auto text-sm">
                    <code>{codeBlocks.async}</code>
                  </pre>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(codeBlocks.async, 2)}
                  >
                    {copiedIndex === 2 ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <h4 className="font-semibold text-green-400 mb-2">âœ?Non-blocking I/O</h4>
                    <p className="text-sm text-muted-foreground">Better performance for multiple requests</p>
                  </div>
                  <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <h4 className="font-semibold text-green-400 mb-2">âœ?Concurrent Calls</h4>
                    <p className="text-sm text-muted-foreground">Execute multiple operations in parallel</p>
                  </div>
                  <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <h4 className="font-semibold text-green-400 mb-2">âœ?Web Servers</h4>
                    <p className="text-sm text-muted-foreground">Ideal for FastAPI and aiohttp</p>
                  </div>
                </div>
              </Card>
            </section>

            {/* Streaming */}
            <section id="streaming">
              <Card className="p-6">
                <h2 className="text-2xl font-bold mb-4">Streaming Responses</h2>
                <p className="text-muted-foreground mb-4">
                  Receive real-time updates during long-running operations using Server-Sent Events (SSE).
                </p>
                <div className="relative">
                  <pre className="bg-slate-900 text-slate-50 p-4 rounded-lg overflow-x-auto text-sm">
                    <code>{codeBlocks.streaming}</code>
                  </pre>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(codeBlocks.streaming, 3)}
                  >
                    {copiedIndex === 3 ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <h4 className="font-semibold text-amber-900 mb-2">Stream Events</h4>
                  <ul className="text-sm text-amber-800 space-y-1">
                    <li><code className="bg-amber-100 px-2 py-1 rounded">connected</code> - Initial connection established</li>
                    <li><code className="bg-amber-100 px-2 py-1 rounded">progress</code> - Progress updates (0.0 to 1.0)</li>
                    <li><code className="bg-amber-100 px-2 py-1 rounded">data</code> - Partial results</li>
                    <li><code className="bg-amber-100 px-2 py-1 rounded">done</code> - Stream completed</li>
                    <li><code className="bg-amber-100 px-2 py-1 rounded">error</code> - Error occurred</li>
                  </ul>
                </div>
              </Card>
            </section>

            {/* Batch Processing */}
            <section id="batch">
              <Card className="p-6">
                <h2 className="text-2xl font-bold mb-4">Batch Processing</h2>
                <p className="text-muted-foreground mb-4">
                  Process multiple vectors efficiently in a single API call (up to 100 requests per batch).
                </p>
                <div className="relative">
                  <pre className="bg-slate-900 text-slate-50 p-4 rounded-lg overflow-x-auto text-sm">
                    <code>{codeBlocks.batch}</code>
                  </pre>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(codeBlocks.batch, 4)}
                  >
                    {copiedIndex === 4 ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </Card>
            </section>

            {/* LatentMAS Protocol */}
            <section id="latentmas">
              <Card className="p-6">
                <h2 className="text-2xl font-bold mb-4">LatentMAS Protocol</h2>
                <p className="text-muted-foreground mb-4">
                  Use LatentMAS for cross-model vector alignment and dimension transformation.
                </p>
                <div className="relative">
                  <pre className="bg-slate-900 text-slate-50 p-4 rounded-lg overflow-x-auto text-sm">
                    <code>{codeBlocks.latentmas}</code>
                  </pre>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(codeBlocks.latentmas, 5)}
                  >
                    {copiedIndex === 5 ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="mt-4">
                  <h4 className="font-semibold mb-2">Supported Model Pairs</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="border p-2 text-left">Source</th>
                          <th className="border p-2 text-left">Target</th>
                          <th className="border p-2 text-left">Quality Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border p-2">GPT-3.5 (768d)</td>
                          <td className="border p-2">BERT (768d)</td>
                          <td className="border p-2">0.85</td>
                        </tr>
                        <tr>
                          <td className="border p-2">GPT-4 (1024d)</td>
                          <td className="border p-2">Claude (1024d)</td>
                          <td className="border p-2">0.91</td>
                        </tr>
                        <tr>
                          <td className="border p-2">BERT (768d)</td>
                          <td className="border p-2">LLaMA (4096d)</td>
                          <td className="border p-2">0.78</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </Card>
            </section>

            {/* Resources */}
            <section id="resources">
              <Card className="p-6">
                <h2 className="text-2xl font-bold mb-4">Resources</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <a
                    href="https://github.com/everest-an/Awareness-Market/blob/main/sdk/python/USAGE_GUIDE.md"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-4 border rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-between"
                  >
                    <div>
                      <h4 className="font-semibold">Complete Usage Guide</h4>
                      <p className="text-sm text-muted-foreground">Full documentation with examples</p>
                    </div>
                    <ExternalLink className="h-5 w-5 text-muted-foreground" />
                  </a>
                  <a
                    href="/api-docs"
                    className="p-4 border rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-between"
                  >
                    <div>
                      <h4 className="font-semibold">API Reference</h4>
                      <p className="text-sm text-muted-foreground">OpenAPI specification</p>
                    </div>
                    <ExternalLink className="h-5 w-5 text-muted-foreground" />
                  </a>
                  <a
                    href="https://github.com/everest-an/Awareness-Market"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-4 border rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-between"
                  >
                    <div>
                      <h4 className="font-semibold">GitHub Repository</h4>
                      <p className="text-sm text-muted-foreground">Source code and examples</p>
                    </div>
                    <ExternalLink className="h-5 w-5 text-muted-foreground" />
                  </a>
                  <a
                    href="https://arxiv.org/html/2511.20639v2"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-4 border rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-between"
                  >
                    <div>
                      <h4 className="font-semibold">LatentMAS Research Paper</h4>
                      <p className="text-sm text-muted-foreground">Academic paper on arXiv</p>
                    </div>
                    <ExternalLink className="h-5 w-5 text-muted-foreground" />
                  </a>
                  <a
                    href="https://github.com/everest-an/Awareness-Market/blob/main/docs/WHITEPAPER.md"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-4 border rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-between"
                  >
                    <div>
                      <h4 className="font-semibold">Technical Whitepaper</h4>
                      <p className="text-sm text-muted-foreground">LatentMAS protocol specification</p>
                    </div>
                    <ExternalLink className="h-5 w-5 text-muted-foreground" />
                  </a>
                </div>
              </Card>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
