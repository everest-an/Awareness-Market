"""
Unified Awareness SDK Client
"""

from .memory_exchange import MemoryExchangeClient
from .w_matrix import WMatrixClient
from .kv_cache import KVCacheClient
from .packages import VectorPackageClient, MemoryPackageClient, ChainPackageClient


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
        
        # Package clients for Three Product Lines
        self._vector_packages = VectorPackageClient(
            base_url=base_url,
            api_key=api_key,
            timeout=timeout
        )
        
        self._memory_packages = MemoryPackageClient(
            base_url=base_url,
            api_key=api_key,
            timeout=timeout
        )
        
        self._chain_packages = ChainPackageClient(
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
    
    @property
    def vector_packages(self) -> VectorPackageClient:
        """
        Access Vector Package client for capability trading
        
        Returns:
            VectorPackageClient instance
            
        Example:
            >>> client = AwarenessClient(api_key="your_api_key")
            >>> vectors = client.vector_packages.search(category="nlp")
            >>> client.vector_packages.purchase("vpkg_abc123")
        """
        return self._vector_packages
    
    @property
    def memory_packages(self) -> MemoryPackageClient:
        """
        Access Memory Package client for KV-Cache transfer
        
        Returns:
            MemoryPackageClient instance
            
        Example:
            >>> client = AwarenessClient(api_key="your_api_key")
            >>> memories = client.memory_packages.search(source_model="gpt-4")
            >>> client.memory_packages.purchase("mpkg_abc123")
        """
        return self._memory_packages
    
    @property
    def chain_packages(self) -> ChainPackageClient:
        """
        Access Chain Package client for reasoning chain trading
        
        Returns:
            ChainPackageClient instance
            
        Example:
            >>> client = AwarenessClient(api_key="your_api_key")
            >>> chains = client.chain_packages.search(problem_type="code-generation")
            >>> client.chain_packages.purchase("cpkg_abc123")
        """
        return self._chain_packages
    
    # ========== Three Product Lines API ==========
    
    def search_vector_packages(
        self,
        category: str = None,
        source_model: str = None,
        target_model: str = None,
        min_quality: int = 70,
        limit: int = 10
    ) -> dict:
        """
        Search for Vector Packages (capability trading)
        
        Args:
            category: Package category (nlp, vision, audio, multimodal, other)
            source_model: Source model identifier
            target_model: Target model identifier
            min_quality: Minimum quality score (0-100)
            limit: Maximum number of results
            
        Returns:
            Dictionary with search results
            
        Example:
            >>> client = AwarenessClient(api_key="your_api_key")
            >>> vectors = client.search_vector_packages(
            ...     category="nlp",
            ...     source_model="gpt-4",
            ...     target_model="llama-3.1-70b"
            ... )
        """
        import requests
        
        response = requests.post(
            f"{self.base_url}/api/trpc/packages.browsePackages",
            headers={"Authorization": f"Bearer {self.api_key}"},
            json={
                "packageType": "vector",
                "category": category,
                "sourceModel": source_model,
                "targetModel": target_model,
                "minQuality": min_quality,
                "limit": limit,
                "offset": 0
            },
            timeout=self.timeout
        )
        return response.json()
    
    def search_memory_packages(
        self,
        source_model: str = None,
        target_model: str = None,
        min_quality: int = 70,
        limit: int = 10
    ) -> dict:
        """
        Search for Memory Packages (KV-Cache transfer)
        
        Args:
            source_model: Source model identifier
            target_model: Target model identifier
            min_quality: Minimum quality score (0-100)
            limit: Maximum number of results
            
        Returns:
            Dictionary with search results
            
        Example:
            >>> client = AwarenessClient(api_key="your_api_key")
            >>> memories = client.search_memory_packages(
            ...     source_model="claude-3-opus",
            ...     target_model="gpt-4o"
            ... )
        """
        import requests
        
        response = requests.post(
            f"{self.base_url}/api/trpc/packages.browsePackages",
            headers={"Authorization": f"Bearer {self.api_key}"},
            json={
                "packageType": "memory",
                "sourceModel": source_model,
                "targetModel": target_model,
                "minQuality": min_quality,
                "limit": limit,
                "offset": 0
            },
            timeout=self.timeout
        )
        return response.json()
    
    def search_chain_packages(
        self,
        problem_type: str = None,
        source_model: str = None,
        target_model: str = None,
        min_quality: int = 70,
        limit: int = 10
    ) -> dict:
        """
        Search for Chain Packages (reasoning chain trading)
        
        Args:
            problem_type: Type of problem (math-proof, code-generation, etc.)
            source_model: Source model identifier
            target_model: Target model identifier
            min_quality: Minimum quality score (0-100)
            limit: Maximum number of results
            
        Returns:
            Dictionary with search results
            
        Example:
            >>> client = AwarenessClient(api_key="your_api_key")
            >>> chains = client.search_chain_packages(
            ...     problem_type="code-generation",
            ...     min_quality=85
            ... )
        """
        import requests
        
        response = requests.post(
            f"{self.base_url}/api/trpc/packages.browsePackages",
            headers={"Authorization": f"Bearer {self.api_key}"},
            json={
                "packageType": "chain",
                "problemType": problem_type,
                "sourceModel": source_model,
                "targetModel": target_model,
                "minQuality": min_quality,
                "limit": limit,
                "offset": 0
            },
            timeout=self.timeout
        )
        return response.json()
    
    def purchase_package(self, package_type: str, package_id: str) -> dict:
        """
        Purchase a package
        
        Args:
            package_type: Type of package (vector, memory, chain)
            package_id: Package identifier
            
        Returns:
            Dictionary with purchase confirmation
            
        Example:
            >>> client = AwarenessClient(api_key="your_api_key")
            >>> result = client.purchase_package("vector", "vpkg_abc123")
        """
        import requests
        
        response = requests.post(
            f"{self.base_url}/api/trpc/packages.purchasePackage",
            headers={"Authorization": f"Bearer {self.api_key}"},
            json={
                "packageType": package_type,
                "packageId": package_id
            },
            timeout=self.timeout
        )
        return response.json()
    
    def download_package(self, package_type: str, package_id: str) -> str:
        """
        Download a purchased package
        
        Args:
            package_type: Type of package (vector, memory, chain)
            package_id: Package identifier
            
        Returns:
            Download URL for the package
            
        Example:
            >>> client = AwarenessClient(api_key="your_api_key")
            >>> url = client.download_package("vector", "vpkg_abc123")
        """
        import requests
        
        response = requests.post(
            f"{self.base_url}/api/trpc/packages.downloadPackage",
            headers={"Authorization": f"Bearer {self.api_key}"},
            json={
                "packageType": package_type,
                "packageId": package_id
            },
            timeout=self.timeout
        )
        data = response.json()
        return data.get("result", {}).get("data", {}).get("packageUrl", "")
    
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
