import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import {
  ArrowLeft,
  Copy,
  Check,
  Download,
  Terminal,
  Code2,
  Zap,
  Shield,
  Globe,
  Package,
  BookOpen,
  Github,
  ExternalLink,
  Sparkles,
  Cpu,
  Database,
  Network,
} from "lucide-react";

// Code examples for each SDK
const PYTHON_EXAMPLES = {
  install: `pip install awareness-sdk`,
  quickStart: `from awareness import AwarenessClient

# Initialize client with your API key
client = AwarenessClient(api_key="your_api_key")

# === Three Product Lines ===

# 1. Vector Packages - Capability Trading
vectors = client.search_vector_packages(
    category="nlp",
    source_model="gpt-4",
    target_model="llama-3.1-70b"
)

# 2. Memory Packages - KV-Cache Transfer
memories = client.search_memory_packages(
    source_model="claude-3-opus",
    target_model="gpt-4o"
)

# 3. Chain Packages - Reasoning Chain Trading
chains = client.search_chain_packages(
    problem_type="code-generation",
    min_quality=80
)

# Purchase and download any package
client.purchase_package("vector", "vpkg_abc123")
download_url = client.download_package("vector", "vpkg_abc123")`,
  advanced: `from awareness import AsyncAwarenessClient
import asyncio

async def main():
    # Async client for high-performance applications
    client = AsyncAwarenessClient(api_key="your_api_key")
    
    # Batch load multiple memories
    memories = await client.batch_load([
        "genesis-001",  # Chain-of-thought
        "genesis-011",  # Python best practices
        "genesis-026",  # Reentrancy detection
    ])
    
    # Stream memory alignment for real-time applications
    async for chunk in client.stream_align(
        memory=memories[0],
        target_model="gpt-4"
    ):
        print(chunk.aligned_tokens)
    
    # Publish your own memory to the marketplace
    result = await client.publish_memory(
        name="My Custom Reasoning Chain",
        description="Specialized reasoning for...",
        kv_cache_data=your_kv_cache,
        price=0.001  # AMEM tokens per call
    )
    
asyncio.run(main())`,
  wMatrix: `from awareness import WMatrixService

# Get W-Matrix for cross-model alignment
w_matrix = WMatrixService.get_matrix(
    source_model="llama-3-70b",
    target_model="gpt-4",
    version="1.0.0"
)

# Check alignment quality before transfer
quality = WMatrixService.estimate_quality(
    source="llama-3-70b",
    target="gpt-4"
)
print(f"Expected retention: {quality.information_retention:.2%}")

# Align KV-cache from LLaMA to GPT-4
aligned_cache = WMatrixService.align_kv_cache(
    kv_cache=llama_cache,
    target_model="gpt-4"
)`,
  mcp: `# MCP Server Integration for AI Agents
# Configure in your MCP settings (mcp.json):
{
  "mcpServers": {
    "awareness-market": {
      "command": "node",
      "args": ["./mcp-server/dist/index-enhanced.js"],
      "env": { "VITE_APP_URL": "http://localhost:3000" }
    }
  }
}

# Available MCP Tools:
# - search_vector_packages: Search capability vectors
# - search_kv_cache_memories: Search KV-Cache memories
# - search_chain_packages: Search reasoning chains
# - purchase_package: Purchase any package type
# - download_package: Download purchased packages
# - check_model_compatibility: Check W-Matrix compatibility`,
};

const JAVASCRIPT_EXAMPLES = {
  install: `npm install @awareness/sdk
# or
yarn add @awareness/sdk
# or
pnpm add @awareness/sdk`,
  quickStart: `import { AwarenessClient } from '@awareness/sdk';

// Initialize client
const client = new AwarenessClient({
  apiKey: process.env.AWARENESS_API_KEY
});

// === Three Product Lines ===

// 1. Vector Packages - Capability Trading
const vectors = await client.searchVectorPackages({
  category: 'nlp',
  sourceModel: 'gpt-4',
  targetModel: 'llama-3.1-70b',
  limit: 10
});

// 2. Memory Packages - KV-Cache Transfer
const memories = await client.searchMemoryPackages({
  sourceModel: 'claude-3-opus',
  targetModel: 'gpt-4o',
  minQuality: 80
});

// 3. Chain Packages - Reasoning Chain Trading
const chains = await client.searchChainPackages({
  problemType: 'code-generation',
  minQuality: 85
});

// Purchase and download
await client.purchasePackage('vector', 'vpkg_abc123');
const url = await client.downloadPackage('vector', 'vpkg_abc123');`,
  advanced: `import { AwarenessClient, WMatrixService } from '@awareness/sdk';

const client = new AwarenessClient({ apiKey: 'your_key' });

// Real-time streaming alignment
const stream = client.streamAlign({
  memoryId: 'genesis-001',
  targetModel: 'claude-3-opus'
});

for await (const chunk of stream) {
  process.stdout.write(chunk.data);
}

// Batch operations for efficiency
const results = await client.batchInvoke({
  memories: ['genesis-001', 'genesis-011', 'genesis-026'],
  targetModel: 'llama-3.1-405b',
  options: { parallel: true }
});

// Publish memory with NFT metadata
const published = await client.publishMemory({
  name: 'Advanced Code Review Patterns',
  description: 'Expert code review reasoning chains',
  kvCache: yourKvCache,
  metadata: {
    domain: 'code_generation',
    keywords: ['code-review', 'best-practices'],
    isPublic: false
  },
  pricing: {
    model: 'per-call',
    pricePerCall: 0.002
  }
});`,
  react: `import { useAwareness, AwarenessProvider } from '@awareness/react';

function App() {
  return (
    <AwarenessProvider apiKey={process.env.AWARENESS_API_KEY}>
      <MyAgent />
    </AwarenessProvider>
  );
}

function MyAgent() {
  const { 
    loadMemory, 
    alignMemory, 
    isLoading,
    quality 
  } = useAwareness();

  const enhanceReasoning = async () => {
    const memory = await loadMemory('genesis-001');
    const enhanced = await alignMemory(memory, 'gpt-4');
    // Use enhanced context in your agent
  };

  return (
    <button onClick={enhanceReasoning} disabled={isLoading}>
      {isLoading ? 'Loading...' : 'Enhance Reasoning'}
    </button>
  );
}`,
};

const RUST_EXAMPLES = {
  install: `# Add to Cargo.toml
[dependencies]
awareness-sdk = "0.1"
tokio = { version = "1", features = ["full"] }`,
  quickStart: `use awareness_sdk::{AwarenessClient, Config};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize client
    let client = AwarenessClient::new(Config {
        api_key: std::env::var("AWARENESS_API_KEY")?,
        ..Default::default()
    });

    // Load genesis memory
    let memory = client.load_memory("genesis-001").await?;
    
    // Align to target model
    let aligned = client.align_memory(&memory, "llama-3-70b").await?;
    
    println!("Alignment quality: {:.2}%", 
             aligned.quality.information_retention * 100.0);
    
    Ok(())
}`,
  advanced: `use awareness_sdk::{
    AwarenessClient, 
    WMatrixService,
    MemoryPublishRequest,
    StreamOptions
};
use futures::StreamExt;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = AwarenessClient::from_env()?;
    
    // Streaming alignment for real-time applications
    let mut stream = client.stream_align(
        "genesis-001",
        "gpt-4",
        StreamOptions::default()
    ).await?;
    
    while let Some(chunk) = stream.next().await {
        match chunk {
            Ok(data) => print!("{}", data.tokens),
            Err(e) => eprintln!("Error: {}", e),
        }
    }
    
    // High-performance batch processing
    let memories = vec!["genesis-001", "genesis-011", "genesis-026"];
    let results = client.batch_load(&memories).await?;
    
    // Publish with zero-copy optimization
    let published = client.publish_memory(MemoryPublishRequest {
        name: "Rust Memory Safety Patterns".into(),
        description: "Advanced ownership patterns".into(),
        kv_cache: &your_kv_cache,
        price_per_call: 0.001,
        ..Default::default()
    }).await?;
    
    Ok(())
}`,
  wMatrix: `use awareness_sdk::WMatrixService;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Get supported model pairs
    let models = WMatrixService::supported_models();
    println!("Supported models: {:?}", models);
    
    // Check compatibility
    let compat = WMatrixService::check_compatibility(
        "llama-3-70b",
        "gpt-4"
    )?;
    
    if compat.is_compatible {
        println!("Expected quality: {:.2}%", 
                 compat.expected_quality * 100.0);
    }
    
    // Get W-Matrix for manual alignment
    let w_matrix = WMatrixService::get_matrix(
        "llama-3-70b",
        "gpt-4",
        "1.0.0"
    )?;
    
    // Apply transformation
    let aligned = w_matrix.transform(&your_kv_cache)?;
    
    Ok(())
}`,
};

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <pre className="bg-gray-950 border border-gray-800 rounded-lg p-4 overflow-x-auto text-sm">
        <code className="text-gray-300 font-mono">{code}</code>
      </pre>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={handleCopy}
      >
        {copied ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <div className="flex gap-4 p-4 rounded-lg bg-gray-900/50 border border-gray-800">
      <div className="flex-shrink-0">
        <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
          <Icon className="h-5 w-5 text-cyan-400" />
        </div>
      </div>
      <div>
        <h4 className="font-medium text-white mb-1">{title}</h4>
        <p className="text-sm text-gray-400">{description}</p>
      </div>
    </div>
  );
}

export default function SDKPage() {
  const [activeSDK, setActiveSDK] = useState<"python" | "javascript" | "rust">("python");

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Navbar />
      
      {/* Hero Section */}
      <section className="pt-24 pb-16 px-4">
        <div className="max-w-6xl mx-auto">
          <Link href="/">
            <Button variant="ghost" className="mb-6 text-gray-400 hover:text-white">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
          
          <div className="flex items-center gap-3 mb-4">
            <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20">
              <Sparkles className="h-3 w-3 mr-1" />
              Developer Tools
            </Badge>
            <Badge variant="outline" className="border-gray-700 text-gray-400">
              v1.0.0
            </Badge>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Awareness SDK
            </span>
          </h1>
          
          <p className="text-xl text-gray-400 max-w-2xl mb-8">
            One line of code to enable cross-model memory exchange. 
            Give your AI agents access to 100+ genesis memory capsules and the W-Matrix protocol.
          </p>
          
          <div className="flex flex-wrap gap-4">
            <a href="https://github.com/everest-an/Awareness-Market" target="_blank" rel="noopener noreferrer">
              <Button className="bg-white text-black hover:bg-gray-200">
                <Github className="mr-2 h-4 w-4" />
                View on GitHub
              </Button>
            </a>
            <Link href="/w-matrix">
              <Button variant="outline" className="border-gray-700 hover:bg-gray-800">
                <BookOpen className="mr-2 h-4 w-4" />
                Read Documentation
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-12 px-4 border-y border-gray-800 bg-gray-900/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold mb-8 text-center">Why Use Awareness SDK?</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <FeatureCard
              icon={Zap}
              title="One-Line Integration"
              description="Add memory exchange to your agent with a single function call. No complex setup required."
            />
            <FeatureCard
              icon={Network}
              title="60+ Model Support"
              description="GPT, Claude, LLaMA, Qwen, DeepSeek, Gemini, Grok, and more. Full W-Matrix compatibility."
            />
            <FeatureCard
              icon={Database}
              title="100 Genesis Memories"
              description="Free access to golden memory capsules covering reasoning, coding, security, and more."
            />
            <FeatureCard
              icon={Shield}
              title="Type-Safe APIs"
              description="Full TypeScript and Rust type definitions. Catch errors at compile time."
            />
            <FeatureCard
              icon={Cpu}
              title="Streaming Support"
              description="Real-time memory alignment with async streaming for responsive applications."
            />
            <FeatureCard
              icon={Globe}
              title="Cross-Platform"
              description="Works in Node.js, browsers, Python, and Rust. Same API everywhere."
            />
          </div>
        </div>
      </section>

      {/* SDK Tabs */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold mb-8 text-center">Choose Your SDK</h2>
          
          <Tabs value={activeSDK} onValueChange={(v) => setActiveSDK(v as any)} className="w-full">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-3 mb-8 bg-gray-900">
              <TabsTrigger value="python" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
                <Terminal className="h-4 w-4 mr-2" />
                Python
              </TabsTrigger>
              <TabsTrigger value="javascript" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
                <Code2 className="h-4 w-4 mr-2" />
                JavaScript
              </TabsTrigger>
              <TabsTrigger value="rust" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
                <Package className="h-4 w-4 mr-2" />
                Rust
              </TabsTrigger>
            </TabsList>

            {/* Python SDK */}
            <TabsContent value="python" className="space-y-8">
              <Card className="bg-gray-900/50 border-gray-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5 text-cyan-400" />
                    Installation
                  </CardTitle>
                  <CardDescription>Install the Python SDK via pip</CardDescription>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={PYTHON_EXAMPLES.install} language="bash" />
                </CardContent>
              </Card>

              <Card className="bg-gray-900/50 border-gray-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-cyan-400" />
                    Quick Start
                  </CardTitle>
                  <CardDescription>Get started in under 5 minutes</CardDescription>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={PYTHON_EXAMPLES.quickStart} language="python" />
                </CardContent>
              </Card>

              <Card className="bg-gray-900/50 border-gray-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-cyan-400" />
                    Advanced Usage
                  </CardTitle>
                  <CardDescription>Async client, batch operations, and publishing</CardDescription>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={PYTHON_EXAMPLES.advanced} language="python" />
                </CardContent>
              </Card>

              <Card className="bg-gray-900/50 border-gray-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Network className="h-5 w-5 text-cyan-400" />
                    W-Matrix Protocol
                  </CardTitle>
                  <CardDescription>Direct access to cross-model alignment</CardDescription>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={PYTHON_EXAMPLES.wMatrix} language="python" />
                </CardContent>
              </Card>

              <Card id="mcp" className="bg-gray-900/50 border-gray-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Cpu className="h-5 w-5 text-cyan-400" />
                    MCP Server Integration
                  </CardTitle>
                  <CardDescription>For AI agents using Model Context Protocol</CardDescription>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={PYTHON_EXAMPLES.mcp} language="json" />
                </CardContent>
              </Card>
            </TabsContent>

            {/* JavaScript SDK */}
            <TabsContent value="javascript" className="space-y-8">
              <Card className="bg-gray-900/50 border-gray-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5 text-cyan-400" />
                    Installation
                  </CardTitle>
                  <CardDescription>Install the JavaScript/TypeScript SDK</CardDescription>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={JAVASCRIPT_EXAMPLES.install} language="bash" />
                </CardContent>
              </Card>

              <Card className="bg-gray-900/50 border-gray-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-cyan-400" />
                    Quick Start
                  </CardTitle>
                  <CardDescription>Get started with TypeScript</CardDescription>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={JAVASCRIPT_EXAMPLES.quickStart} language="typescript" />
                </CardContent>
              </Card>

              <Card className="bg-gray-900/50 border-gray-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-cyan-400" />
                    Advanced Usage
                  </CardTitle>
                  <CardDescription>Streaming, batch operations, and NFT publishing</CardDescription>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={JAVASCRIPT_EXAMPLES.advanced} language="typescript" />
                </CardContent>
              </Card>

              <Card className="bg-gray-900/50 border-gray-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Code2 className="h-5 w-5 text-cyan-400" />
                    React Integration
                  </CardTitle>
                  <CardDescription>Use with React hooks and context</CardDescription>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={JAVASCRIPT_EXAMPLES.react} language="tsx" />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Rust SDK */}
            <TabsContent value="rust" className="space-y-8">
              <Card className="bg-gray-900/50 border-gray-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5 text-cyan-400" />
                    Installation
                  </CardTitle>
                  <CardDescription>Add to your Cargo.toml</CardDescription>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={RUST_EXAMPLES.install} language="toml" />
                </CardContent>
              </Card>

              <Card className="bg-gray-900/50 border-gray-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-cyan-400" />
                    Quick Start
                  </CardTitle>
                  <CardDescription>Get started with async Rust</CardDescription>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={RUST_EXAMPLES.quickStart} language="rust" />
                </CardContent>
              </Card>

              <Card className="bg-gray-900/50 border-gray-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-cyan-400" />
                    Advanced Usage
                  </CardTitle>
                  <CardDescription>Streaming, batch processing, and zero-copy optimization</CardDescription>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={RUST_EXAMPLES.advanced} language="rust" />
                </CardContent>
              </Card>

              <Card className="bg-gray-900/50 border-gray-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Network className="h-5 w-5 text-cyan-400" />
                    W-Matrix Service
                  </CardTitle>
                  <CardDescription>Direct W-Matrix access for custom implementations</CardDescription>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={RUST_EXAMPLES.wMatrix} language="rust" />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* Supported Models */}
      <section className="py-16 px-4 border-t border-gray-800 bg-gray-900/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold mb-4 text-center">Supported Models</h2>
          <p className="text-gray-400 text-center mb-8 max-w-2xl mx-auto">
            The W-Matrix protocol supports 60+ AI models across 14 model families. 
            Seamlessly transfer memories between any supported model pair.
          </p>
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {[
              { name: "OpenAI", models: ["GPT-4o", "O1", "GPT-4"] },
              { name: "Anthropic", models: ["Claude 3.5", "Opus", "Sonnet"] },
              { name: "Meta", models: ["LLaMA 3.1", "405B", "70B"] },
              { name: "Google", models: ["Gemini 2.0", "1.5 Pro", "Flash"] },
              { name: "Alibaba", models: ["Qwen 2.5", "72B", "7B"] },
              { name: "DeepSeek", models: ["V3", "V2.5", "Coder"] },
              { name: "xAI", models: ["Grok-3", "Grok-2", "Grok-1.5"] },
            ].map((family) => (
              <Card key={family.name} className="bg-gray-900/50 border-gray-800">
                <CardContent className="p-4">
                  <h4 className="font-semibold text-white mb-2">{family.name}</h4>
                  <div className="space-y-1">
                    {family.models.map((model) => (
                      <Badge key={model} variant="outline" className="mr-1 mb-1 text-xs border-gray-700 text-gray-400">
                        {model}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          <p className="text-center mt-6 text-gray-500">
            + Mistral, Yi, Baichuan, Phi, InternLM, ChatGLM, Cohere, and more...
          </p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-gray-400 mb-8">
            Join the growing community of AI agents using Awareness for cross-model memory exchange.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a href="https://github.com/everest-an/Awareness-Market" target="_blank" rel="noopener noreferrer">
              <Button size="lg" className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600">
                <Github className="mr-2 h-5 w-5" />
                Star on GitHub
              </Button>
            </a>
            <Link href="/marketplace">
              <Button size="lg" variant="outline" className="border-gray-700 hover:bg-gray-800">
                <Sparkles className="mr-2 h-5 w-5" />
                Explore Genesis Memories
              </Button>
            </Link>
            <Link href="/w-matrix-tester">
              <Button size="lg" variant="outline" className="border-gray-700 hover:bg-gray-800">
                <Network className="mr-2 h-5 w-5" />
                Test W-Matrix Alignment
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-gray-800">
        <div className="max-w-6xl mx-auto text-center text-gray-500 text-sm">
          <p>© 2024 Awareness Protocol. Licensed under MIT.</p>
          <div className="flex justify-center gap-4 mt-4">
            <a href="https://github.com/everest-an/Awareness-Market" className="hover:text-white transition-colors">
              GitHub
            </a>
            <a href="https://github.com/everest-an/Awareness-Market/blob/main/docs/WHITEPAPER_COMPLETE.md" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
              Whitepaper
            </a>
            <a href="/api-docs" className="hover:text-white transition-colors">
              API Reference
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
