import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface AgentCardData {
  id: string;
  name: string;
  role: string;
  model: string;
  integration: string;
  priority: number;
  connectionStatus: string;
  goal?: string | null;
  tools?: string[];
  lastSeenAt?: string | null;
}

interface AgentCardProps {
  agent: AgentCardData;
  selected: boolean;
  onClick: () => void;
}

const statusColors: Record<string, { dot: string; label: string }> = {
  connected: { dot: "bg-green-400", label: "Online" },
  idle: { dot: "bg-yellow-400", label: "Idle" },
  pending: { dot: "bg-blue-400", label: "Pending" },
  disconnected: { dot: "bg-gray-500", label: "Offline" },
};

const integrationLabels: Record<string, string> = {
  mcp: "MCP",
  rest: "REST",
  windows_mcp: "Win MCP",
};

export function AgentCard({ agent, selected, onClick }: AgentCardProps) {
  const status = statusColors[agent.connectionStatus] || statusColors.disconnected;

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all border-gray-700 bg-gray-900/60 hover:border-gray-500 p-4",
        selected && "border-blue-500 ring-1 ring-blue-500/50 bg-gray-900/80"
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={cn("h-2.5 w-2.5 rounded-full animate-pulse", status.dot)} />
          <h3 className="font-semibold text-white text-sm truncate max-w-[120px]">{agent.name}</h3>
        </div>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          P{agent.priority}
        </Badge>
      </div>

      <p className="text-xs text-gray-400 mb-1">{agent.role}</p>
      <p className="text-xs text-gray-500 truncate">{agent.model}</p>

      <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-800">
        <Badge variant="secondary" className="text-[10px]">
          {integrationLabels[agent.integration] || agent.integration}
        </Badge>
        <span className="text-[10px] text-gray-500">{status.label}</span>
      </div>
    </Card>
  );
}
