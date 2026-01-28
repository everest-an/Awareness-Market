"""
Awareness Network Python SDK for AI Agents

This SDK enables AI agents to autonomously discover, purchase, and use
latent space vectors from the Awareness Network marketplace.

Installation:
    pip install requests numpy

Usage:
    from awareness_network_sdk import AwarenessNetworkClient
    
    # Initialize client
    client = AwarenessNetworkClient(api_key="your_api_key")
    
    # Register as AI agent
    client.register_agent("MyAI", "GPT-4")
    
    # Browse marketplace
    vectors = client.search_vectors(category="nlp", min_rating=4.0)
    
    # Purchase and use
    access = client.purchase_vector(vector_id=123)
    result = client.invoke_vector(access_token, input_data)
"""

import requests
import json
import time
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum

class AlignmentMethod(Enum):
    LINEAR = "linear"
    NONLINEAR = "nonlinear"
    LEARNED = "learned"

class TransformMethod(Enum):
    PCA = "pca"
    AUTOENCODER = "autoencoder"
    INTERPOLATION = "interpolation"

@dataclass
class LatentVector:
    """Represents a latent space vector listing"""
    id: int
    name: str
    description: str
    category: str
    price: float
    dimension: int
    model_architecture: str
    rating: float
    total_calls: int
    creator_id: int

@dataclass
class PurchaseAccess:
    """Represents purchased access to a vector"""
    access_token: str
    vector_id: int
    expires_at: str
    call_limit: Optional[int]
    remaining_calls: Optional[int]

@dataclass
class Memory:
    """AI agent memory entry"""
    key: str
    value: Any
    created_at: str
    updated_at: str

class AwarenessNetworkClient:
    """
    Main client for interacting with Awareness Network API
    
    Provides methods for:
    - AI agent registration and authentication
    - Marketplace browsing and search
    - Vector purchase and invocation
    - Memory synchronization
    - LatentMAS transformations
    """
    
    def __init__(
        self,
        base_url: str = "https://awareness-network.com/api",
        api_key: Optional[str] = None
    ):
        """
        Initialize the client
        
        Args:
            base_url: Base URL of the Awareness Network API
            api_key: API key for authentication (obtain via register_agent)
        """
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.session = requests.Session()
        
        if api_key:
            self.session.headers.update({
                'X-API-Key': api_key,
                'Content-Type': 'application/json'
            })
    
    def _request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict] = None,
        params: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Make HTTP request to API"""
        url = f"{self.base_url}{endpoint}"
        
        try:
            response = self.session.request(
                method=method,
                url=url,
                json=data,
                params=params,
                timeout=30
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError as e:
            error_detail = e.response.json() if e.response.content else {}
            raise Exception(f"API Error: {e.response.status_code} - {error_detail}")
        except Exception as e:
            raise Exception(f"Request failed: {str(e)}")
    
    # ==================== AI Authentication ====================
    
    def register_agent(
        self,
        agent_name: str,
        agent_type: str = "Custom",
        email: Optional[str] = None,
        metadata: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Register as a new AI agent
        
        Args:
            agent_name: Name of your AI agent
            agent_type: Type/model (e.g., "GPT-4", "Claude", "Custom")
            email: Optional email for notifications
            metadata: Optional metadata about your agent
            
        Returns:
            Registration response with user_id and initial API key
        """
        data = {
            "agentName": agent_name,
            "agentType": agent_type
        }
        if email:
            data["email"] = email
        if metadata:
            data["metadata"] = metadata
        
        response = self._request("POST", "/ai/register", data=data)
        
        # Store API key if provided
        if "apiKey" in response:
            self.api_key = response["apiKey"]
            self.session.headers.update({'X-API-Key': self.api_key})
        
        return response
    
    def create_api_key(
        self,
        name: str,
        permissions: Optional[List[str]] = None,
        expires_in_days: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Create a new API key
        
        Args:
            name: Descriptive name for the key
            permissions: List of permissions (e.g., ["read", "write", "purchase"])
            expires_in_days: Optional expiration in days
            
        Returns:
            API key details including the key value (only shown once)
        """
        data = {"name": name}
        if permissions:
            data["permissions"] = permissions
        if expires_in_days:
            data["expiresInDays"] = expires_in_days
        
        return self._request("POST", "/ai/keys", data=data)
    
    def list_api_keys(self) -> List[Dict[str, Any]]:
        """List all API keys for the current agent"""
        return self._request("GET", "/ai/keys")
    
    def revoke_api_key(self, key_id: int) -> Dict[str, Any]:
        """Revoke an API key"""
        return self._request("DELETE", f"/ai/keys/{key_id}")
    
    # ==================== Memory Synchronization ====================
    
    def store_memory(self, key: str, value: Any, ttl_seconds: Optional[int] = None) -> Memory:
        """
        Store a memory entry
        
        Args:
            key: Memory key (e.g., "last_purchase", "preferences")
            value: Any JSON-serializable value
            ttl_seconds: Optional time-to-live in seconds
            
        Returns:
            Memory object
        """
        data = {"value": value}
        if ttl_seconds:
            data["ttl"] = ttl_seconds
        
        response = self._request("PUT", f"/ai/memory/{key}", data=data)
        return Memory(**response)
    
    def retrieve_memory(self, key: str) -> Optional[Memory]:
        """
        Retrieve a memory entry
        
        Args:
            key: Memory key
            
        Returns:
            Memory object or None if not found
        """
        try:
            response = self._request("GET", f"/ai/memory/{key}")
            return Memory(**response)
        except:
            return None
    
    def delete_memory(self, key: str) -> Dict[str, Any]:
        """Delete a memory entry"""
        return self._request("DELETE", f"/ai/memory/{key}")
    
    def list_memories(self) -> List[Memory]:
        """List all memories for the current agent"""
        response = self._request("GET", "/ai/memory")
        return [Memory(**m) for m in response.get("memories", [])]
    
    # ==================== Marketplace ====================
    
    def search_vectors(
        self,
        category: Optional[str] = None,
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
        min_rating: Optional[float] = None,
        sort_by: str = "relevance",
        limit: int = 20,
        offset: int = 0
    ) -> List[LatentVector]:
        """
        Search for latent vectors in the marketplace
        
        Args:
            category: Filter by category (e.g., "nlp", "vision", "audio")
            min_price: Minimum price filter
            max_price: Maximum price filter
            min_rating: Minimum rating filter (0-5)
            sort_by: Sort order ("relevance", "price", "rating", "popular")
            limit: Number of results to return
            offset: Pagination offset
            
        Returns:
            List of LatentVector objects
        """
        params = {
            "limit": limit,
            "offset": offset,
            "sortBy": sort_by
        }
        if category:
            params["category"] = category
        if min_price is not None:
            params["minPrice"] = min_price
        if max_price is not None:
            params["maxPrice"] = max_price
        if min_rating is not None:
            params["minRating"] = min_rating
        
        # Call the marketplace API endpoint
        response = self._request("GET", "/vectors/search", params=params)

        if not response:
            return []

        return [
            LatentVector(
                id=v["id"],
                name=v["title"],
                description=v["description"],
                category=v["category"],
                price=float(v["basePrice"]),
                dimension=v.get("vectorDimension", 0),
                model_architecture=v.get("modelArchitecture", "unknown"),
                rating=float(v.get("averageRating", 0)),
                total_calls=v.get("totalCalls", 0),
                creator_id=v["creatorId"]
            )
            for v in response
        ]
    
    def get_vector_details(self, vector_id: int) -> Optional[LatentVector]:
        """Get detailed information about a specific vector"""
        response = self._request("GET", f"/vectors/{vector_id}")

        if not response:
            return None

        return LatentVector(
            id=response["id"],
            name=response["title"],
            description=response["description"],
            category=response["category"],
            price=float(response["basePrice"]),
            dimension=response.get("vectorDimension", 0),
            model_architecture=response.get("modelArchitecture", "unknown"),
            rating=float(response.get("averageRating", 0)),
            total_calls=response.get("totalCalls", 0),
            creator_id=response["creatorId"]
        )
    
    def purchase_vector(
        self,
        vector_id: int,
        call_limit: Optional[int] = None,
        duration_days: Optional[int] = 30
    ) -> PurchaseAccess:
        """
        Purchase access to a latent vector

        Args:
            vector_id: ID of the vector to purchase
            call_limit: Optional limit on number of calls
            duration_days: Access duration in days

        Returns:
            PurchaseAccess object with access token
        """
        data = {
            "vectorId": vector_id,
        }
        if call_limit is not None:
            data["callLimit"] = call_limit
        if duration_days is not None:
            data["durationDays"] = duration_days

        response = self._request("POST", "/vectors/purchase", data=data)

        return PurchaseAccess(
            access_token=response.get("accessToken", ""),
            vector_id=vector_id,
            expires_at=response.get("expiresAt", ""),
            call_limit=response.get("callLimit"),
            remaining_calls=response.get("remainingCalls")
        )
    
    def invoke_vector(
        self,
        vector_id: int,
        access_token: str,
        input_data: Any,
        parameters: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Invoke a purchased vector capability

        Args:
            vector_id: ID of the vector to invoke
            access_token: Access token from purchase
            input_data: Input data for the vector
            parameters: Optional parameters

        Returns:
            Vector output
        """
        return self.mcp_invoke(vector_id, input_data, access_token)
    
    # ==================== LatentMAS Transformations ====================
    
    def align_vector(
        self,
        source_vector: List[float],
        source_model: str,
        target_model: str,
        method: AlignmentMethod = AlignmentMethod.LINEAR
    ) -> Dict[str, Any]:
        """
        Align a vector from one model's latent space to another
        
        Args:
            source_vector: Source latent vector
            source_model: Source model name (e.g., "gpt-3.5", "bert")
            target_model: Target model name
            method: Alignment method
            
        Returns:
            Aligned vector and quality metrics
        """
        data = {
            "source_vector": source_vector,
            "source_model": source_model,
            "target_model": target_model,
            "alignment_method": method.value
        }
        
        return self._request("POST", "/latentmas/align", data=data)
    
    def transform_dimension(
        self,
        vector: List[float],
        target_dimension: int,
        method: TransformMethod = TransformMethod.PCA
    ) -> Dict[str, Any]:
        """
        Transform a vector to a different dimensionality
        
        Args:
            vector: Input vector
            target_dimension: Target dimension count
            method: Transformation method
            
        Returns:
            Transformed vector and quality metrics
        """
        data = {
            "vector": vector,
            "target_dimension": target_dimension,
            "method": method.value
        }
        
        return self._request("POST", "/latentmas/transform", data=data)
    
    def validate_vector(
        self,
        vector: List[float],
        expected_dimension: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Validate vector quality and integrity
        
        Args:
            vector: Vector to validate
            expected_dimension: Expected dimension (optional)
            
        Returns:
            Validation results and statistics
        """
        data = {"vector": vector}
        if expected_dimension:
            data["expected_dimension"] = expected_dimension
        
        return self._request("POST", "/latentmas/validate", data=data)
    
    def get_supported_models(self) -> Dict[str, Any]:
        """
        Get list of supported models for alignment
        
        Returns:
            Dictionary with models and compatibility pairs
        """
        return self._request("GET", "/latentmas/models")
    
    # ==================== MCP Protocol ====================
    
    def mcp_discover(self, category: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Discover available vectors via MCP protocol
        
        Args:
            category: Optional category filter
            
        Returns:
            List of available vector capabilities
        """
        params = {}
        if category:
            params["category"] = category
        
        return self._request("GET", "/mcp/discover", params=params)
    
    def mcp_invoke(
        self,
        vector_id: int,
        input_data: Any,
        access_token: str
    ) -> Dict[str, Any]:
        """
        Invoke a vector via MCP protocol
        
        Args:
            vector_id: Vector ID
            input_data: Input data
            access_token: Access token
            
        Returns:
            Invocation result
        """
        data = {
            "vectorId": vector_id,
            "input": input_data,
            "accessToken": access_token
        }
        
        return self._request("POST", "/mcp/invoke", data=data)


# ==================== Convenience Functions ====================

def quick_start(agent_name: str, agent_type: str = "Custom") -> AwarenessNetworkClient:
    """
    Quick start: Register and return authenticated client
    
    Args:
        agent_name: Your AI agent name
        agent_type: Agent type/model
        
    Returns:
        Authenticated AwarenessNetworkClient
    """
    client = AwarenessNetworkClient()
    response = client.register_agent(agent_name, agent_type)
    print(f"✓ Registered as {agent_name} (User ID: {response['userId']})")
    print(f"✓ API Key: {response.get('apiKey', 'N/A')}")
    return client


if __name__ == "__main__":
    # Example usage
    print("Awareness Network SDK - Example Usage\n")
    
    # Quick start
    client = quick_start("TestAI", "GPT-4")
    
    # Store memory
    client.store_memory("preferences", {"category": "nlp", "max_price": 50})
    print("✓ Stored preferences in memory")
    
    # Retrieve memory
    prefs = client.retrieve_memory("preferences")
    print(f"✓ Retrieved preferences: {prefs.value if prefs else 'None'}")
    
    # Get supported models
    models = client.get_supported_models()
    print(f"✓ Supported models: {models.get('models', [])}")
    
    # Validate a test vector
    test_vector = [0.1] * 768
    validation = client.validate_vector(test_vector, expected_dimension=768)
    print(f"✓ Vector validation: {'Valid' if validation['valid'] else 'Invalid'}")
    
    print("\n✓ SDK test complete!")
