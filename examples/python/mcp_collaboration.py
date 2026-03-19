"""
Awareness Market — Multi-AI Collaboration via MCP

Create a collaboration workspace, add AI agents, and run a collaborative task.

Usage:
    pip install requests
    python mcp_collaboration.py
"""

import requests
import json

BASE_URL = "http://localhost:3001"


def main():
    print("Awareness Market — Multi-AI Collaboration Demo\n")

    # Step 1: Authenticate (get a session token)
    print("1. Authenticating...")
    auth_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "demo@example.com",
        "password": "demo-password",
    })
    if not auth_resp.ok:
        print("   Auth failed. Make sure you have a demo account:")
        print("   pnpm create-demo-account")
        return

    token = auth_resp.json().get("token", "")
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    # Step 2: Create a workspace
    print("2. Creating collaboration workspace...")
    ws_resp = requests.post(f"{BASE_URL}/api/trpc/workspace.create", json={
        "name": "Demo Collaboration",
        "description": "Multi-agent demo workspace",
    }, headers=headers)
    if ws_resp.ok:
        workspace = ws_resp.json().get("result", {}).get("data", {})
        ws_id = workspace.get("id", "unknown")
        print(f"   Workspace created: {ws_id}")
    else:
        print(f"   Workspace creation returned {ws_resp.status_code}")
        return

    # Step 3: Create a collaboration session with two agents
    print("3. Creating collaboration session...")
    session_resp = requests.post(f"{BASE_URL}/api/trpc/agentCollaboration.createSession", json={
        "workspaceId": ws_id,
        "agents": [
            {"role": "architect", "name": "Claude", "weight": 1.0},
            {"role": "frontend", "name": "v0", "weight": 0.7},
        ],
        "task": "Design a REST API for a knowledge sharing platform",
    }, headers=headers)
    if session_resp.ok:
        session = session_resp.json().get("result", {}).get("data", {})
        session_id = session.get("sessionId", "unknown")
        mcp_token = session.get("mcpToken", "")
        print(f"   Session: {session_id}")
        print(f"   MCP Token: {mcp_token[:20]}..." if mcp_token else "   (no MCP token)")
    else:
        print(f"   Session creation returned {session_resp.status_code}")
        return

    # Step 4: Share reasoning as an agent
    print("4. Sharing reasoning...")
    mcp_headers = {
        "Authorization": f"Bearer {mcp_token}" if mcp_token else f"Bearer {token}",
        "Content-Type": "application/json",
        "X-Agent-Role": "architect",
    }
    reason_resp = requests.post(f"{BASE_URL}/mcp", json={
        "jsonrpc": "2.0",
        "method": "tools/call",
        "params": {
            "name": "share_reasoning",
            "arguments": {
                "reasoning": "We should use RESTful conventions with versioned endpoints.",
                "decision": "Use /api/v1/ prefix for all endpoints",
                "questions": ["Should we support GraphQL as well?"],
            },
        },
        "id": 1,
    }, headers=mcp_headers)
    if reason_resp.ok:
        print("   Reasoning shared successfully")
    else:
        print(f"   Share reasoning returned {reason_resp.status_code}")

    # Step 5: Get collaboration history
    print("5. Fetching collaboration history...")
    history_resp = requests.post(f"{BASE_URL}/mcp", json={
        "jsonrpc": "2.0",
        "method": "tools/call",
        "params": {
            "name": "get_collaboration_history",
            "arguments": {"filter": "all", "limit": 10},
        },
        "id": 2,
    }, headers=mcp_headers)
    if history_resp.ok:
        result = history_resp.json()
        print(f"   History entries: {json.dumps(result, indent=2)[:200]}...")
    else:
        print(f"   History fetch returned {history_resp.status_code}")

    print("\nDone! Connect Claude Desktop to this session using the MCP token above.")
    print("See mcp-server/README.md for MCP client configuration.")


if __name__ == "__main__":
    main()
