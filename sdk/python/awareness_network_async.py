"""
Awareness Network SDK - Async Version
Async/await support for high-performance applications
"""

import asyncio
import aiohttp
import hashlib
import json
from typing import Dict, List, Optional, Any, AsyncIterator
from dataclasses import dataclass
from datetime import datetime


@dataclass
class Vector:
    """Represents a latent space vector"""
    id: int
    name: str
    description: str
    category: str
    dimension: int
    pricing_per_call: float
    pricing_subscription: Optional[float]
    creator_id: int
    performance_metrics: Dict[str, Any]
    created_at: datetime


@dataclass
class Purchase:
    """Represents a vector purchase"""
    id: int
    vector_id: int
    buyer_id: int
    pricing_tier: str
    access_token: str
    expires_at: Optional[datetime]
    call_limit: Optional[int]
    calls_used: int


@dataclass
class InvocationResult:
    """Represents the result of a vector invocation"""
    success: bool
    result: Any
    latency_ms: float
    calls_remaining: Optional[int]


class AsyncAwarenessClient:
    """
    Async client for Awareness Network API
    
    Example:
        async with AsyncAwarenessClient(api_key="your_key") as client:
            vectors = await client.vectors.list()
            result = await client.vectors.invoke(1, {"text": "Hello"})
    """
    
    def __init__(
        self,
        api_key: str,
        base_url: str = "https://awareness-network.com",
        timeout: int = 30,
        max_retries: int = 3
    ):
        self.api_key = api_key
        self.base_url = base_url.rstrip('/')
        self.timeout = aiohttp.ClientTimeout(total=timeout)
        self.max_retries = max_retries
        self._session: Optional[aiohttp.ClientSession] = None
        
        # Initialize sub-clients
        self.vectors = VectorsAsyncClient(self)
        self.neural_bridge = NeuralBridgeAsyncClient(self)
        self.memory = MemoryAsyncClient(self)
    
    async def __aenter__(self):
        """Async context manager entry"""
        self._session = aiohttp.ClientSession(
            headers={
                'X-API-Key': self.api_key,
                'Content-Type': 'application/json',
                'User-Agent': 'awareness-network-sdk-async/1.0.0'
            },
            timeout=self.timeout
        )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        if self._session:
            await self._session.close()
    
    async def _request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict] = None,
        params: Optional[Dict] = None,
        stream: bool = False
    ) -> Any:
        """Make an async HTTP request with retry logic"""
        if not self._session:
            raise RuntimeError("Client must be used as async context manager")
        
        url = f"{self.base_url}{endpoint}"
        
        for attempt in range(self.max_retries):
            try:
                async with self._session.request(
                    method,
                    url,
                    json=data,
                    params=params
                ) as response:
                    if stream:
                        return response  # Return response object for streaming
                    
                    response.raise_for_status()
                    return await response.json()
                    
            except aiohttp.ClientError as e:
                if attempt == self.max_retries - 1:
                    raise Exception(f"Request failed after {self.max_retries} attempts: {e}")
                await asyncio.sleep(2 ** attempt)  # Exponential backoff


class VectorsAsyncClient:
    """Async client for vector operations"""
    
    def __init__(self, client: AsyncAwarenessClient):
        self.client = client
    
    async def list(
        self,
        category: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Vector]:
        """List available vectors"""
        params = {'limit': limit, 'offset': offset}
        if category:
            params['category'] = category
        
        data = await self.client._request('GET', '/api/vectors', params=params)
        return [Vector(**item) for item in data]
    
    async def get(self, vector_id: int) -> Vector:
        """Get vector details"""
        data = await self.client._request('GET', f'/api/vectors/{vector_id}')
        return Vector(**data)
    
    async def purchase(
        self,
        vector_id: int,
        pricing_tier: str = 'per-call',
        call_limit: Optional[int] = None
    ) -> Purchase:
        """Purchase a vector"""
        data = await self.client._request(
            'POST',
            '/api/vectors/purchase',
            data={
                'vectorId': vector_id,
                'pricingTier': pricing_tier,
                'callLimit': call_limit
            }
        )
        return Purchase(**data)
    
    async def invoke(
        self,
        vector_id: int,
        input_data: Dict[str, Any],
        access_token: Optional[str] = None
    ) -> InvocationResult:
        """Invoke a purchased vector"""
        data = await self.client._request(
            'POST',
            '/api/vectors/invoke',
            data={
                'vectorId': vector_id,
                'inputData': input_data,
                'accessToken': access_token
            }
        )
        return InvocationResult(**data)
    
    async def invoke_stream(
        self,
        vector_id: int,
        input_data: Dict[str, Any],
        access_token: Optional[str] = None
    ) -> AsyncIterator[Dict[str, Any]]:
        """Invoke a vector with streaming response (SSE)"""
        response = await self.client._request(
            'POST',
            '/api/vectors/invoke/stream',
            data={
                'vectorId': vector_id,
                'inputData': input_data,
                'accessToken': access_token
            },
            stream=True
        )
        
        async for line in response.content:
            line = line.decode('utf-8').strip()
            if line.startswith('data: '):
                try:
                    yield json.loads(line[6:])
                except json.JSONDecodeError:
                    continue
    
    async def batch_invoke(
        self,
        requests: List[Dict[str, Any]]
    ) -> List[InvocationResult]:
        """Batch invoke multiple vectors"""
        data = await self.client._request(
            'POST',
            '/api/vectors/batch-invoke',
            data={'requests': requests}
        )
        return [InvocationResult(**item) for item in data['results']]
    
    async def my_purchases(self) -> List[Purchase]:
        """Get user's purchase history"""
        data = await self.client._request('GET', '/api/vectors/my-purchases')
        return [Purchase(**item) for item in data]


class NeuralBridgeAsyncClient:
    """Async client for Neural Bridge protocol operations"""
    
    def __init__(self, client: AsyncAwarenessClient):
        self.client = client
    
    async def align(
        self,
        source_vector: List[float],
        source_model: str,
        target_model: str
    ) -> Dict[str, Any]:
        """Align vector from source model to target model"""
        data = await self.client._request(
            'POST',
            '/api/latentmas/align',
            data={
                'source_vector': source_vector,
                'source_model': source_model,
                'target_model': target_model
            }
        )
        return data
    
    async def transform(
        self,
        vector: List[float],
        target_dimension: int,
        method: str = 'pca'
    ) -> Dict[str, Any]:
        """Transform vector to different dimension"""
        data = await self.client._request(
            'POST',
            '/api/latentmas/transform',
            data={
                'vector': vector,
                'target_dimension': target_dimension,
                'method': method
            }
        )
        return data
    
    async def validate(
        self,
        original_vector: List[float],
        aligned_vector: List[float]
    ) -> Dict[str, Any]:
        """Validate alignment quality"""
        data = await self.client._request(
            'POST',
            '/api/latentmas/validate',
            data={
                'original_vector': original_vector,
                'aligned_vector': aligned_vector
            }
        )
        return data


class MemoryAsyncClient:
    """Async client for AI memory operations"""
    
    def __init__(self, client: AsyncAwarenessClient):
        self.client = client
    
    async def get(self, key: str) -> Optional[Dict[str, Any]]:
        """Get memory value"""
        try:
            data = await self.client._request('GET', f'/api/ai/memory/{key}')
            return data
        except Exception:
            return None
    
    async def set(self, key: str, value: Dict[str, Any]) -> bool:
        """Set memory value"""
        try:
            await self.client._request(
                'PUT',
                f'/api/ai/memory/{key}',
                data={'value': value}
            )
            return True
        except Exception:
            return False
    
    async def delete(self, key: str) -> bool:
        """Delete memory value"""
        try:
            await self.client._request('DELETE', f'/api/ai/memory/{key}')
            return True
        except Exception:
            return False
    
    async def list_keys(self) -> List[str]:
        """List all memory keys"""
        data = await self.client._request('GET', '/api/ai/memory')
        return data.get('keys', [])


# Convenience function for quick async usage
async def quick_invoke(
    api_key: str,
    vector_id: int,
    input_data: Dict[str, Any],
    base_url: str = "https://awareness-network.com"
) -> InvocationResult:
    """Quick async vector invocation"""
    async with AsyncAwarenessClient(api_key, base_url) as client:
        return await client.vectors.invoke(vector_id, input_data)


# Example usage
if __name__ == "__main__":
    async def main():
        api_key = "your_api_key_here"
        
        async with AsyncAwarenessClient(api_key) as client:
            # List vectors
            vectors = await client.vectors.list(category="nlp", limit=10)
            print(f"Found {len(vectors)} NLP vectors")
            
            # Get vector details
            if vectors:
                vector = await client.vectors.get(vectors[0].id)
                print(f"Vector: {vector.name}")
                
                # Purchase vector
                purchase = await client.vectors.purchase(
                    vector.id,
                    pricing_tier="per-call"
                )
                print(f"Purchased: {purchase.access_token}")
                
                # Invoke vector
                result = await client.vectors.invoke(
                    vector.id,
                    {"text": "Hello, world!"},
                    access_token=purchase.access_token
                )
                print(f"Result: {result.result}")
                
                # Stream invocation
                print("Streaming response:")
                async for chunk in client.vectors.invoke_stream(
                    vector.id,
                    {"text": "Tell me a story"},
                    access_token=purchase.access_token
                ):
                    print(chunk, end='', flush=True)
                
                # Batch invocation
                requests = [
                    {"vectorId": vector.id, "inputData": {"text": f"Request {i}"}}
                    for i in range(5)
                ]
                results = await client.vectors.batch_invoke(requests)
                print(f"\nBatch results: {len(results)} completed")
    
    asyncio.run(main())
