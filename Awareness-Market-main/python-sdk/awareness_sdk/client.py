"""
Unified Awareness SDK Client
"""

from .memory_exchange import MemoryExchangeClient
from .w_matrix import WMatrixClient
from .kv_cache import KVCacheClient


class AwarenessClient:
    """
    Unified client for Awareness Marketplace
    
    Provides access to:
    - Memory Exchange Service (KV-Cache and reasoning chain trading)
    - W-Matrix Marketplace Service (alignment tools)
    - KV-Cache Compression Service (production-grade compression)
    
    Example:
        >>> from awareness_sdk import AwarenessClient
        >>> 
        >>> # Initialize client with API key
        >>> client = AwarenessClient(api_key="your_api_key")
        >>> 
        >>> # Use Memory Exchange
        >>> memories = client.memory_exchange.browse_memories(limit=10)
        >>> 
        >>> # Use W-Matrix Marketplace
        >>> listings = client.w_matrix.browse_listings(
        ...     source_model="gpt-3.5",
        ...     target_model="gpt-4"
        ... )
        >>> 
        >>> # Use KV-Cache Compression
        >>> result = client.kv_cache.compress(
        ...     model_name="gpt-4",
        ...     keys=[[1.0, 2.0]], values=[[3.0, 4.0]], queries=[[5.0, 6.0]]
        ... )
    """
    
    def __init__(
        self,
        api_key: str,
        base_url: str = "http://localhost:3000",
        memory_exchange_url: str = "http://localhost:8080",
        w_matrix_url: str = "http://localhost:8081",
        timeout: int = 30
    ):
        """
        Initialize Awareness SDK client
        
        Args:
            api_key: API key for authentication (required)
            memory_exchange_url: Base URL for Memory Exchange service
            w_matrix_url: Base URL for W-Matrix Marketplace service
            timeout: Request timeout in seconds
            
        Example:
            >>> # Local development
            >>> client = AwarenessClient(api_key="your_api_key")
            >>> 
            >>> # Production
            >>> client = AwarenessClient(
            ...     api_key="your_api_key",
            ...     memory_exchange_url="https://api.awareness.market/memory-exchange",
            ...     w_matrix_url="https://api.awareness.market/w-matrix"
            ... )
        """
        if not api_key:
            raise ValueError("API key is required")
        
        self.api_key = api_key
        self.base_url = base_url
        self.timeout = timeout
        
        # Initialize sub-clients
        self._memory_exchange = MemoryExchangeClient(
            base_url=memory_exchange_url,
            api_key=api_key,
            timeout=timeout
        )
        
        self._w_matrix = WMatrixClient(
            base_url=w_matrix_url,
            api_key=api_key,
            timeout=timeout
        )
        
        self._kv_cache = KVCacheClient(
            base_url=base_url,
            api_key=api_key,
            timeout=timeout
        )
    
    @property
    def memory_exchange(self) -> MemoryExchangeClient:
        """
        Access Memory Exchange client
        
        Returns:
            MemoryExchangeClient instance
            
        Example:
            >>> client = AwarenessClient(api_key="your_api_key")
            >>> result = client.memory_exchange.browse_memories(limit=10)
        """
        return self._memory_exchange
    
    @property
    def w_matrix(self) -> WMatrixClient:
        """
        Access W-Matrix Marketplace client
        
        Returns:
            WMatrixClient instance
            
        Example:
            >>> client = AwarenessClient(api_key="your_api_key")
            >>> listings = client.w_matrix.browse_listings(limit=10)
        """
        return self._w_matrix
    
    @property
    def kv_cache(self) -> KVCacheClient:
        """
        Access KV-Cache Compression client
        
        Returns:
            KVCacheClient instance
            
        Example:
            >>> client = AwarenessClient(api_key="your_api_key")
            >>> result = client.kv_cache.compress(
            ...     model_name="gpt-4",
            ...     keys=[[1.0, 2.0]], values=[[3.0, 4.0]], queries=[[5.0, 6.0]]
            ... )
        """
        return self._kv_cache
    
    def health_check(self) -> dict:
        """
        Check health status of both services
        
        Returns:
            Dictionary with health status of each service
            
        Example:
            >>> client = AwarenessClient(api_key="your_api_key")
            >>> status = client.health_check()
            >>> print(status)
            {
                'memory_exchange': {'status': 'ok', 'version': '1.0.0'},
                'w_matrix': {'status': 'ok', 'version': '1.0.0'}
            }
        """
        import requests
        
        result = {}
        
        # Check Memory Exchange
        try:
            response = requests.get(
                f"{self._memory_exchange.base_url}/health",
                timeout=self.timeout
            )
            result['memory_exchange'] = response.json()
        except Exception as e:
            result['memory_exchange'] = {'status': 'error', 'error': str(e)}
        
        # Check W-Matrix Marketplace
        try:
            response = requests.get(
                f"{self._w_matrix.base_url}/health",
                timeout=self.timeout
            )
            result['w_matrix'] = response.json()
        except Exception as e:
            result['w_matrix'] = {'status': 'error', 'error': str(e)}
        
        return result
