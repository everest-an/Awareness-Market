"""
Awareness Network API - Python Example
========================================

This example demonstrates how to interact with the Awareness Network API
using Python. It shows AI agent registration, vector browsing, purchasing,
and invocation.

Requirements:
    pip install requests

Usage:
    python python_example.py
"""

import requests
import json
from typing import Dict, List, Optional

# API Base URL (replace with your actual deployment URL)
BASE_URL = "https://awareness.market"
API_URL = f"{BASE_URL}/api"


class AwarenessNetworkClient:
    """Client for interacting with Awareness Network API"""
    
    def __init__(self, base_url: str = API_URL):
        self.base_url = base_url
        self.api_key: Optional[str] = None
        self.session = requests.Session()
    
    def register_ai_agent(self, agent_name: str, agent_type: str, capabilities: List[str]) -> Dict:
        """
        Register a new AI agent and get API key
        
        Args:
            agent_name: Name of the AI agent
            agent_description: Description of agent's purpose
            capabilities: List of agent capabilities
            
        Returns:
            Registration response with API key
        """
        response = self.session.post(
            f"{self.base_url}/ai/register",
            json={
                "agentName": agent_name,
                "agentType": agent_type,
                "metadata": {"capabilities": capabilities}
            }
        )
        response.raise_for_status()
        data = response.json()
        
        # Store API key for future requests
        self.api_key = data["apiKey"]
        self.session.headers.update({"X-API-Key": self.api_key})
        
        print(f"✓ Registered AI agent: {agent_name}")
        print(f"  API Key: {self.api_key[:20]}...")
        
        return data
    
    def browse_marketplace(self, category: Optional[str] = None, min_rating: Optional[float] = None) -> List[Dict]:
        """
        Browse available latent vectors in the marketplace
        
        Args:
            category: Filter by category (e.g., "finance", "code-generation")
            min_price: Minimum price filter
            max_price: Maximum price filter
            sort_by: Sort order ("newest", "price_asc", "price_desc", "rating", "popular")
            
        Returns:
            List of available vectors
        """
        params = {"limit": 20}
        if category:
            params["category"] = category
        if min_rating is not None:
            params["minRating"] = min_rating

        response = self.session.get(f"{self.base_url}/mcp/discover", params=params)
        response.raise_for_status()
        vectors = response.json().get("vectors", [])
        
        print(f"✓ Found {len(vectors)} vectors")
        return vectors
    
    def create_mcp_token(self, name: str = "team-sync") -> Dict:
        """Create a collaboration MCP token for multi-agent sync."""
        if not self.api_key:
            raise ValueError("API key required. Please register first.")

        response = self.session.post(
            f"{self.base_url}/mcp/tokens",
            headers={"X-API-Key": self.api_key},
            json={"name": name}
        )
        response.raise_for_status()
        token_data = response.json()

        print("✓ Created MCP token")
        return token_data

    def sync_agents(self, mcp_token: str, agents: List[Dict], shared_context: Optional[Dict] = None, memory_key: str = "team:session:alpha") -> Dict:
        """Run multi-agent sync with shared context."""
        response = self.session.post(
            f"{self.base_url}/mcp/sync",
            headers={"X-MCP-Token": mcp_token, "Content-Type": "application/json"},
            json={
                "memory_key": memory_key,
                "shared_context": shared_context or {},
                "agents": agents
            }
        )
        response.raise_for_status()
        return response.json()

    def invoke_vector(self, vector_id: int, context: str, access_token: str) -> Dict:
        """
        Invoke a purchased latent vector with input data
        
        Args:
            vector_id: ID of the vector to invoke
            input_data: Input data for the vector
            
        Returns:
            Vector output and metadata
        """
        response = self.session.post(
            f"{self.base_url}/mcp/invoke",
            headers={"Authorization": f"Bearer {access_token}"},
            json={
                "vector_id": vector_id,
                "context": context
            }
        )
        response.raise_for_status()
        result = response.json()
        
        print(f"✓ Invoked vector {vector_id}")
        
        return result
    
    def sync_memory(self, memory_key: str, memory_value: Dict) -> Dict:
        """
        Sync AI agent memory to the platform
        
        Args:
            memory_key: Unique key for the memory
            memory_value: Memory data to store
            
        Returns:
            Sync confirmation
        """
        if not self.api_key:
            raise ValueError("API key required. Please register first.")
        
        response = self.session.put(
            f"{self.base_url}/ai/memory/{memory_key}",
            json={
                "data": memory_value,
                "ttlDays": 30
            }
        )
        response.raise_for_status()
        
        print(f"✓ Synced memory: {memory_key}")
        
        return response.json()
    
    def retrieve_memory(self, memory_key: str) -> Dict:
        """
        Retrieve previously synced memory
        
        Args:
            memory_key: Key of the memory to retrieve
            
        Returns:
            Memory data
        """
        if not self.api_key:
            raise ValueError("API key required. Please register first.")
        
        response = self.session.get(f"{self.base_url}/ai/memory/{memory_key}")
        response.raise_for_status()
        
        return response.json()


def main():
    """Example usage of the Awareness Network API"""
    
    # Initialize client
    client = AwarenessNetworkClient()
    
    # Step 1: Register AI agent
    print("\n=== Step 1: Register AI Agent ===")
    registration = client.register_ai_agent(
        agent_name="FinanceAnalyzerBot",
        agent_type="custom",
        capabilities=["data-analysis", "forecasting", "risk-assessment"]
    )
    
    # Step 2: Create MCP collaboration token
    print("\n=== Step 2: Create MCP Token ===")
    token_data = client.create_mcp_token()
    mcp_token = token_data["token"]

    # Step 3: Run multi-agent sync
    print("\n=== Step 3: Multi-Agent Sync ===")
    sync_result = client.sync_agents(
        mcp_token=mcp_token,
        shared_context={"topic": "market reasoning"},
        agents=[
            {"id": "agent-a", "messages": [{"role": "user", "content": "Analyze risks."}]},
            {"id": "agent-b", "messages": [{"role": "user", "content": "Summarize opportunities."}]}
        ]
    )
    print(f"Consensus: {sync_result.get('consensus')}")

    # Step 4: Browse marketplace
    print("\n=== Step 4: Browse Marketplace ===")
    vectors = client.browse_marketplace(category="finance", min_rating=4.0)
    
    # Display top 3 vectors
    for i, vector in enumerate(vectors[:3], 1):
        print(f"\n{i}. {vector['title']}")
        print(f"   Category: {vector['category']}")
        print(f"   Price: ${vector['basePrice']}")
        print(f"   Rating: {vector['averageRating']}⭐ ({vector['reviewCount']} reviews)")
    
    # Step 5: Invoke vector (after purchase)
    print("\n=== Step 5: Invoke Vector (Example) ===")
    print("Note: Purchase in the web UI to obtain an access token")
    # result = client.invoke_vector(
    #     vector_id=vectors[0]['id'],
    #     context="Analyze Q4 revenue trends",
    #     access_token="ACCESS_TOKEN_FROM_PURCHASE"
    # )
    # print(f"Result: {result}")

    # Step 6: Sync agent memory
    print("\n=== Step 6: Sync Agent Memory ===")
    client.sync_memory(
        memory_key="preferences",
        memory_value={
            "favorite_categories": ["finance", "data-analysis"],
            "budget": 100.0,
            "last_purchase": None
        }
    )
    
    # Step 7: Retrieve memory
    print("\n=== Step 7: Retrieve Memory ===")
    memory = client.retrieve_memory("preferences")
    print(f"Retrieved memory: {json.dumps(memory, indent=2)}")
    
    print("\n✅ Example completed successfully!")


if __name__ == "__main__":
    main()
