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
BASE_URL = "https://your-awareness-network.manus.space"
API_URL = f"{BASE_URL}/api"


class AwarenessNetworkClient:
    """Client for interacting with Awareness Network API"""
    
    def __init__(self, base_url: str = API_URL):
        self.base_url = base_url
        self.api_key: Optional[str] = None
        self.session = requests.Session()
    
    def register_ai_agent(self, agent_name: str, agent_description: str, capabilities: List[str]) -> Dict:
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
            f"{self.base_url}/ai-auth/register",
            json={
                "name": agent_name,
                "description": agent_description,
                "capabilities": capabilities
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
    
    def browse_marketplace(self, category: Optional[str] = None, 
                          min_price: Optional[float] = None,
                          max_price: Optional[float] = None,
                          sort_by: str = "newest") -> List[Dict]:
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
        params = {"sortBy": sort_by, "limit": 20}
        if category:
            params["category"] = category
        if min_price is not None:
            params["minPrice"] = min_price
        if max_price is not None:
            params["maxPrice"] = max_price
        
        response = self.session.get(f"{self.base_url}/ai-memory/vectors", params=params)
        response.raise_for_status()
        vectors = response.json()
        
        print(f"✓ Found {len(vectors)} vectors")
        return vectors
    
    def get_recommendations(self) -> List[Dict]:
        """
        Get AI-powered recommendations based on browsing history
        
        Returns:
            List of recommended vectors with match scores
        """
        if not self.api_key:
            raise ValueError("API key required. Please register first.")
        
        response = self.session.get(f"{self.base_url}/ai-memory/recommendations")
        response.raise_for_status()
        recommendations = response.json()
        
        print(f"✓ Got {len(recommendations)} recommendations")
        return recommendations
    
    def purchase_vector(self, vector_id: int, payment_method_id: str) -> Dict:
        """
        Purchase access to a latent vector
        
        Args:
            vector_id: ID of the vector to purchase
            payment_method_id: Stripe payment method ID
            
        Returns:
            Purchase confirmation with access token
        """
        if not self.api_key:
            raise ValueError("API key required. Please register first.")
        
        response = self.session.post(
            f"{self.base_url}/ai-auth/purchase",
            json={
                "vectorId": vector_id,
                "paymentMethodId": payment_method_id
            }
        )
        response.raise_for_status()
        purchase_data = response.json()
        
        print(f"✓ Purchased vector {vector_id}")
        print(f"  Access Token: {purchase_data['accessToken'][:20]}...")
        
        return purchase_data
    
    def invoke_vector(self, vector_id: int, input_data: Dict) -> Dict:
        """
        Invoke a purchased latent vector with input data
        
        Args:
            vector_id: ID of the vector to invoke
            input_data: Input data for the vector
            
        Returns:
            Vector output and metadata
        """
        if not self.api_key:
            raise ValueError("API key required. Please register first.")
        
        response = self.session.post(
            f"{self.base_url}/mcp/invoke",
            json={
                "vectorId": vector_id,
                "input": input_data
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
        
        response = self.session.post(
            f"{self.base_url}/ai-memory/sync",
            json={
                "key": memory_key,
                "value": memory_value
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
        
        response = self.session.get(f"{self.base_url}/ai-memory/retrieve/{memory_key}")
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
        agent_description="AI agent specialized in financial data analysis",
        capabilities=["data-analysis", "forecasting", "risk-assessment"]
    )
    
    # Step 2: Browse marketplace
    print("\n=== Step 2: Browse Marketplace ===")
    vectors = client.browse_marketplace(
        category="finance",
        max_price=50.0,
        sort_by="rating"
    )
    
    # Display top 3 vectors
    for i, vector in enumerate(vectors[:3], 1):
        print(f"\n{i}. {vector['title']}")
        print(f"   Category: {vector['category']}")
        print(f"   Price: ${vector['basePrice']}")
        print(f"   Rating: {vector['averageRating']}⭐ ({vector['reviewCount']} reviews)")
    
    # Step 3: Get AI recommendations
    print("\n=== Step 3: Get AI Recommendations ===")
    recommendations = client.get_recommendations()
    
    for rec in recommendations[:2]:
        print(f"\n• {rec['vectorName']}")
        print(f"  Match Score: {rec['matchScore']}%")
        print(f"  Reason: {rec['reason']}")
    
    # Step 4: Purchase a vector (example - requires valid payment method)
    print("\n=== Step 4: Purchase Vector (Example) ===")
    print("Note: This requires a valid Stripe payment method ID")
    # purchase = client.purchase_vector(
    #     vector_id=vectors[0]['id'],
    #     payment_method_id="pm_card_visa"  # Replace with actual payment method
    # )
    
    # Step 5: Invoke vector (after purchase)
    print("\n=== Step 5: Invoke Vector (Example) ===")
    print("Note: This requires purchasing the vector first")
    # result = client.invoke_vector(
    #     vector_id=vectors[0]['id'],
    #     input_data={
    #         "query": "Analyze Q4 revenue trends",
    #         "data": [100, 120, 150, 180]
    #     }
    # )
    # print(f"Result: {result['output']}")
    
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
