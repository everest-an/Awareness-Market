"""
Type stubs for Awareness Network SDK
Provides type hints for better IDE support and type checking
"""

from typing import List, Dict, Any, Optional, AsyncIterator
from dataclasses import dataclass
from datetime import datetime
from enum import Enum

class AlignmentMethod(Enum):
    LINEAR: str
    NONLINEAR: str
    LEARNED: str

class TransformMethod(Enum):
    PCA: str
    AUTOENCODER: str
    INTERPOLATION: str

@dataclass
class LatentVector:
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
    access_token: str
    vector_id: int
    expires_at: str
    call_limit: Optional[int]
    remaining_calls: Optional[int]

@dataclass
class Memory:
    key: str
    value: Any
    created_at: str
    updated_at: str

@dataclass
class Vector:
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
    success: bool
    result: Any
    latency_ms: float
    calls_remaining: Optional[int]

class AwarenessNetworkClient:
    base_url: str
    api_key: Optional[str]
    session: Any
    
    def __init__(
        self,
        base_url: str = ...,
        api_key: Optional[str] = ...
    ) -> None: ...
    
    def _request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict] = ...,
        params: Optional[Dict] = ...
    ) -> Dict[str, Any]: ...
    
    def register_agent(
        self,
        agent_name: str,
        agent_type: str = ...,
        email: Optional[str] = ...,
        metadata: Optional[Dict] = ...
    ) -> Dict[str, Any]: ...
    
    def create_api_key(
        self,
        name: str,
        permissions: Optional[List[str]] = ...,
        expires_in_days: Optional[int] = ...
    ) -> Dict[str, Any]: ...
    
    def list_api_keys(self) -> List[Dict[str, Any]]: ...
    
    def revoke_api_key(self, key_id: int) -> Dict[str, Any]: ...
    
    def store_memory(
        self,
        key: str,
        value: Any,
        ttl_seconds: Optional[int] = ...
    ) -> Memory: ...
    
    def retrieve_memory(self, key: str) -> Optional[Memory]: ...
    
    def delete_memory(self, key: str) -> Dict[str, Any]: ...
    
    def list_memories(self) -> List[Memory]: ...
    
    def search_vectors(
        self,
        category: Optional[str] = ...,
        min_price: Optional[float] = ...,
        max_price: Optional[float] = ...,
        min_rating: Optional[float] = ...,
        sort_by: str = ...,
        limit: int = ...,
        offset: int = ...
    ) -> List[LatentVector]: ...
    
    def get_vector_details(self, vector_id: int) -> LatentVector: ...
    
    def purchase_vector(
        self,
        vector_id: int,
        call_limit: Optional[int] = ...,
        duration_days: Optional[int] = ...
    ) -> PurchaseAccess: ...
    
    def invoke_vector(
        self,
        access_token: str,
        input_data: Any,
        parameters: Optional[Dict] = ...
    ) -> Dict[str, Any]: ...
    
    def align_vector(
        self,
        source_vector: List[float],
        source_model: str,
        target_model: str,
        method: AlignmentMethod = ...
    ) -> Dict[str, Any]: ...
    
    def transform_dimension(
        self,
        vector: List[float],
        target_dimension: int,
        method: TransformMethod = ...
    ) -> Dict[str, Any]: ...
    
    def validate_vector(
        self,
        vector: List[float],
        expected_dimension: Optional[int] = ...
    ) -> Dict[str, Any]: ...
    
    def get_supported_models(self) -> Dict[str, Any]: ...
    
    def mcp_discover(
        self,
        category: Optional[str] = ...
    ) -> List[Dict[str, Any]]: ...
    
    def mcp_invoke(
        self,
        vector_id: int,
        input_data: Any,
        access_token: str
    ) -> Dict[str, Any]: ...

class AsyncAwarenessClient:
    api_key: str
    base_url: str
    timeout: Any
    max_retries: int
    _session: Optional[Any]
    vectors: VectorsAsyncClient
    latentmas: LatentMASAsyncClient
    memory: MemoryAsyncClient
    
    def __init__(
        self,
        api_key: str,
        base_url: str = ...,
        timeout: int = ...,
        max_retries: int = ...
    ) -> None: ...
    
    async def __aenter__(self) -> AsyncAwarenessClient: ...
    
    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None: ...
    
    async def _request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict] = ...,
        params: Optional[Dict] = ...,
        stream: bool = ...
    ) -> Any: ...

class VectorsAsyncClient:
    client: AsyncAwarenessClient
    
    def __init__(self, client: AsyncAwarenessClient) -> None: ...
    
    async def list(
        self,
        category: Optional[str] = ...,
        limit: int = ...,
        offset: int = ...
    ) -> List[Vector]: ...
    
    async def get(self, vector_id: int) -> Vector: ...
    
    async def purchase(
        self,
        vector_id: int,
        pricing_tier: str = ...,
        call_limit: Optional[int] = ...
    ) -> Purchase: ...
    
    async def invoke(
        self,
        vector_id: int,
        input_data: Dict[str, Any],
        access_token: Optional[str] = ...
    ) -> InvocationResult: ...
    
    async def invoke_stream(
        self,
        vector_id: int,
        input_data: Dict[str, Any],
        access_token: Optional[str] = ...
    ) -> AsyncIterator[Dict[str, Any]]: ...
    
    async def batch_invoke(
        self,
        requests: List[Dict[str, Any]]
    ) -> List[InvocationResult]: ...
    
    async def my_purchases(self) -> List[Purchase]: ...

class LatentMASAsyncClient:
    client: AsyncAwarenessClient
    
    def __init__(self, client: AsyncAwarenessClient) -> None: ...
    
    async def align(
        self,
        source_vector: List[float],
        source_model: str,
        target_model: str
    ) -> Dict[str, Any]: ...
    
    async def transform(
        self,
        vector: List[float],
        target_dimension: int,
        method: str = ...
    ) -> Dict[str, Any]: ...
    
    async def validate(
        self,
        original_vector: List[float],
        aligned_vector: List[float]
    ) -> Dict[str, Any]: ...

class MemoryAsyncClient:
    client: AsyncAwarenessClient
    
    def __init__(self, client: AsyncAwarenessClient) -> None: ...
    
    async def get(self, key: str) -> Optional[Dict[str, Any]]: ...
    
    async def set(self, key: str, value: Dict[str, Any]) -> bool: ...
    
    async def delete(self, key: str) -> bool: ...
    
    async def list_keys(self) -> List[str]: ...

def quick_start(
    agent_name: str,
    agent_type: str = ...
) -> AwarenessNetworkClient: ...

async def quick_invoke(
    api_key: str,
    vector_id: int,
    input_data: Dict[str, Any],
    base_url: str = ...
) -> InvocationResult: ...
