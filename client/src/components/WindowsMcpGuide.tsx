import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Monitor } from "lucide-react";

/**
 * Windows MCP Bridge setup guide.
 * Displays step-by-step instructions for connecting non-MCP tools
 * (e.g., v0, browser-based IDEs) via the Windows MCP Server screen control bridge.
 */
export function WindowsMcpGuide({ workspaceName, tokenMask }: { workspaceName: string; tokenMask: string }) {
  return (
    <Card className="bg-gray-900/50 border-gray-700">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Monitor className="h-4 w-4 text-blue-400" />
          Windows MCP Bridge Setup
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-gray-300">
        <div className="space-y-3">
          <div className="flex gap-3">
            <Badge variant="outline" className="shrink-0 mt-0.5">1</Badge>
            <div>
              <p className="font-medium text-white">Install Windows MCP Server</p>
              <code className="text-xs text-blue-400 bg-gray-950 px-2 py-1 rounded mt-1 inline-block">
                npx windows-mcp-server
              </code>
            </div>
          </div>

          <div className="flex gap-3">
            <Badge variant="outline" className="shrink-0 mt-0.5">2</Badge>
            <div>
              <p className="font-medium text-white">Configure Awareness Bridge</p>
              <p className="text-gray-400 text-xs mt-1">
                Point the bridge at your workspace MCP token:
              </p>
              <code className="text-xs text-green-400 bg-gray-950 px-2 py-1 rounded mt-1 inline-block">
                Token: {tokenMask}
              </code>
              <p className="text-gray-500 text-xs mt-1">
                Workspace: {workspaceName}
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Badge variant="outline" className="shrink-0 mt-0.5">3</Badge>
            <div>
              <p className="font-medium text-white">Define Screen Region</p>
              <p className="text-gray-400 text-xs mt-1">
                Use the Windows MCP UI to define the target tool's window region —
                input area, output area, and action buttons.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Badge variant="outline" className="shrink-0 mt-0.5">4</Badge>
            <div>
              <p className="font-medium text-white">Test Connection</p>
              <p className="text-gray-400 text-xs mt-1">
                Run a test command from the Control Center to verify the bridge
                can interact with the target application.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-gray-800">
          <a
            href="https://windowsmcpserver.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline text-xs"
          >
            windowsmcpserver.dev — Full documentation
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
