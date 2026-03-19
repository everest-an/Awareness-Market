/**
 * Awareness Market — Multi-AI Collaboration via MCP
 *
 * Create a workspace, spin up a collaboration session, and interact
 * with the MCP server using the JSON-RPC protocol.
 *
 * Usage:
 *   npm install
 *   npx tsx mcp_collaboration.ts
 */

const BASE_URL = "http://localhost:3001";

async function jsonRpc(
  endpoint: string,
  method: string,
  params: Record<string, unknown>,
  headers: Record<string, string>,
  id = 1
) {
  const resp = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id }),
  });
  return resp.json();
}

async function main() {
  console.log("Awareness Market — Multi-AI Collaboration Demo\n");

  // 1. Authenticate
  console.log("1. Authenticating...");
  const authResp = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "demo@example.com",
      password: "demo-password",
    }),
  });

  if (!authResp.ok) {
    console.log("   Auth failed. Create a demo account first: pnpm create-demo-account");
    return;
  }

  const { token } = await authResp.json();
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // 2. Create workspace
  console.log("2. Creating workspace...");
  const wsResp = await fetch(`${BASE_URL}/api/trpc/workspace.create`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "TS Collaboration Demo",
      description: "TypeScript multi-agent demo",
    }),
  });

  if (!wsResp.ok) {
    console.log(`   Workspace creation failed (${wsResp.status})`);
    return;
  }

  const wsData = await wsResp.json();
  const workspaceId = wsData.result?.data?.id;
  console.log(`   Workspace: ${workspaceId}`);

  // 3. Create session with two agents
  console.log("3. Creating collaboration session...");
  const sessionResp = await fetch(
    `${BASE_URL}/api/trpc/agentCollaboration.createSession`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        workspaceId,
        agents: [
          { role: "architect", name: "Claude", weight: 1.0 },
          { role: "frontend", name: "v0", weight: 0.7 },
        ],
        task: "Design a real-time dashboard for AI memory visualization",
      }),
    }
  );

  if (!sessionResp.ok) {
    console.log(`   Session creation failed (${sessionResp.status})`);
    return;
  }

  const sessionData = await sessionResp.json();
  const { sessionId, mcpToken } = sessionData.result?.data ?? {};
  console.log(`   Session: ${sessionId}`);
  console.log(`   MCP Token: ${mcpToken?.slice(0, 20)}...`);

  // 4. Interact via MCP JSON-RPC
  const mcpHeaders = {
    Authorization: `Bearer ${mcpToken ?? token}`,
    "Content-Type": "application/json",
    "X-Agent-Role": "architect",
  };

  console.log("\n4. Sharing reasoning via MCP...");
  const shareResult = await jsonRpc(
    `${BASE_URL}/mcp`,
    "tools/call",
    {
      name: "share_reasoning",
      arguments: {
        reasoning:
          "For real-time visualization, we need WebSocket for live updates and Three.js for 3D rendering of memory graphs.",
        decision: "Use Socket.IO + Three.js with React wrapper",
        questions: [
          "Should we support 2D fallback for low-end devices?",
          "What refresh rate for live memory updates?",
        ],
      },
    },
    mcpHeaders
  );
  console.log(`   Result: ${JSON.stringify(shareResult).slice(0, 100)}...`);

  console.log("\n5. Proposing a shared decision...");
  const decisionResult = await jsonRpc(
    `${BASE_URL}/mcp`,
    "tools/call",
    {
      name: "propose_shared_decision",
      arguments: {
        decision: "Use React Three Fiber for 3D memory visualization",
        reasoning:
          "React Three Fiber integrates natively with React component lifecycle, making it easier to manage state updates from WebSocket events.",
        alternatives: [
          "Raw Three.js — more control but harder React integration",
          "D3.js — 2D only, but simpler",
        ],
      },
    },
    mcpHeaders
  );
  console.log(`   Result: ${JSON.stringify(decisionResult).slice(0, 100)}...`);

  console.log("\n6. Fetching collaboration history...");
  const historyResult = await jsonRpc(
    `${BASE_URL}/mcp`,
    "tools/call",
    {
      name: "get_collaboration_history",
      arguments: { filter: "decisions", limit: 5 },
    },
    mcpHeaders
  );
  console.log(`   History: ${JSON.stringify(historyResult).slice(0, 200)}...`);

  console.log("\nDone! Connect Claude Desktop using this MCP config:");
  console.log(
    JSON.stringify(
      {
        mcpServers: {
          "awareness-market": {
            command: "node",
            args: ["./mcp-server/dist/index-enhanced.js"],
            env: { VITE_APP_URL: BASE_URL },
          },
        },
      },
      null,
      2
    )
  );
}

main().catch(console.error);
