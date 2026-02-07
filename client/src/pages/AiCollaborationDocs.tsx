import { Card } from "@/components/ui/card";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Copy, Check, ExternalLink, Terminal, Brain, MessageSquare, Shield } from "lucide-react";
import { useState } from "react";
import Navbar from "@/components/Navbar";

export default function AiCollaborationDocs() {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const codeBlocks = {
    install: `cd Awareness-Network/mcp-server
pnpm install
pnpm run build:collab`,
    config: `{
  "mcpServers": {
    "awareness-collab": {
      "command": "node",
      "args": ["/absolute/path/to/Awareness-Network/mcp-server/dist/index-collaboration.js"],
      "env": {
        "AWARENESS_API_KEY": "ak_live_your_key",
        "COLLABORATION_ROLE": "frontend"
      }
    }
  }
}`,
    usage: `User: "Let's work with Claude to build the login page. You handle the React components."

Manus: "I will start the collaboration session with Claude via Awareness MCP..."`
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 pt-24 pb-16">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header */}
          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight">AI Collaboration (MCP)</h1>
            <p className="text-xl text-muted-foreground">
              Enable Manus and Claude to think, code, and debug together in a shared latent space.
            </p>
          </div>

          {/* Feature Overview */}
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="p-6 space-y-3">
              <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Brain className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg">Shared Cognition</h3>
              <p className="text-sm text-muted-foreground">
                Agents share reasoning chains and decision contexts instantly via MCP protocol.
              </p>
            </Card>
            <Card className="p-6 space-y-3">
              <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <MessageSquare className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg">Real-time Sync</h3>
              <p className="text-sm text-muted-foreground">
                Frontend (Manus) and Backend (Claude) changes are synchronized automatically.
              </p>
            </Card>
            <Card className="p-6 space-y-3">
              <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg">Secure Handshake</h3>
              <p className="text-sm text-muted-foreground">
                Authenticated via Awareness API Keys with role-based permissions (frontend/backend).
              </p>
            </Card>
          </div>

          {/* Quick Start Guide */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Quick Start Guide</h2>
            
            <Card className="p-6 space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <div className="bg-primary/10 p-1 rounded text-primary text-xs font-mono">STEP 1</div>
                Build the MCP Server
              </h3>
              <p className="text-sm text-muted-foreground">
                Compile the collaboration server from the source code.
              </p>
              <div className="relative group">
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto font-mono text-sm">
                  {codeBlocks.install}
                </pre>
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => copyToClipboard(codeBlocks.install, 1)}
                >
                  {copiedIndex === 1 ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </Card>

            <Card className="p-6 space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <div className="bg-primary/10 p-1 rounded text-primary text-xs font-mono">STEP 2</div>
                Configure Claude Desktop / Manus
              </h3>
              <p className="text-sm text-muted-foreground">
                Add the server configuration to your MCP config file (e.g., <code>claude_desktop_config.json</code>).
              </p>
              <div className="relative group">
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto font-mono text-sm">
                  {codeBlocks.config}
                </pre>
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => copyToClipboard(codeBlocks.config, 2)}
                >
                  {copiedIndex === 2 ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <div className="text-sm bg-yellow-500/10 text-yellow-500 p-3 rounded-md border border-yellow-500/20">
                <strong>Important:</strong> Set <code>COLLABORATION_ROLE</code> to "frontend" for Manus and "backend" for Claude.
              </div>
            </Card>

            <Card className="p-6 space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <div className="bg-primary/10 p-1 rounded text-primary text-xs font-mono">STEP 3</div>
                Start Collaborating
              </h3>
              <p className="text-sm text-muted-foreground">
                Simply instruct your agent to collaborate with the other party. The <code>share_reasoning</code> tool will be invoked automatically.
              </p>
              <div className="relative group">
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto font-mono text-sm italic">
                  {codeBlocks.usage}
                </pre>
              </div>
            </Card>
          </div>

          {/* Resources Links */}
          <div className="pt-6 border-t">
             <div className="flex gap-4 flex-wrap">
               <Link href="/api-keys">
                <Button variant="outline" className="gap-2">
                  <Key className="h-4 w-4" />
                  Get API Key
                </Button>
               </Link>
               <a href="https://github.com/everest-an/Awareness-Market/tree/main/Awareness-Network/mcp-server" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="gap-2">
                  <ExternalLink className="h-4 w-4" />
                  View Source Code
                </Button>
               </a>
             </div>
          </div>
        </div>
      </main>
    </div>
  );
}

import { Key } from "lucide-react";
