"""
Memory Exchange Client - KV-Cache and Reasoning Chain trading
"""

import requests
from typing import Dict, List, Optional, Any
from .exceptions import APIError, ValidationError, NotFoundError, NetworkError


class MemoryExchangeClient:
    """
    Client for Memory Exchange Service (port 8080)
    
    Provides methods for:
    - Publishing KV-Cache memories
    - Purchasing memories
    - Browsing available memories
    - Managing transaction history
    - Publishing and using reasoning chains
    """
    
    def __init__(self, base_url: str, api_key: str, timeout: int = 30):
        """
        Initialize Memory Exchange client
        
        Args:
            base_url: Base URL of Memory Exchange service (e.g., "http://localhost:8080")
            api_key: API key for authentication
            timeout: Request timeout in seconds
        """
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        })
    
    def _request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """
        Make HTTP request to Memory Exchange API
        
        Args:
            method: HTTP method (GET, POST, etc.)
            endpoint: API endpoint path
            **kwargs: Additional arguments for requests
            
        Returns:
            Response JSON data
            
        Raises:
            APIError: If API returns error response
            NetworkError: If network request fails
        """
        url = f"{self.base_url}{endpoint}"
        kwargs.setdefault('timeout', self.timeout)
        
        try:
            response = self.session.request(method, url, **kwargs)
            data = response.json()
            
            if not data.get('success', False):
                error_msg = data.get('error', 'Unknown error')
                if response.status_code == 404:
                    raise NotFoundError(error_msg)
                raise APIError(error_msg, status_code=response.status_code, response=data)
            
            return data.get('data', data)
            
        except requests.exceptions.RequestException as e:
            raise NetworkError(f"Network request failed: {str(e)}")
    
    def publish_memory(
        self,
        memory_type: str,
        kv_cache_data: Dict[str, Any],
        price: float,
        description: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Publish a new KV-Cache memory to the exchange
        
        Args:
            memory_type: Type of memory (kv_cache, reasoning_chain, long_term_memory)
            kv_cache_data: KV-Cache data dictionary
            price: Price in USD
            description: Optional description
            
        Returns:
            Dictionary with memory_id and message
            
        Example:
            >>> result = client.memory_exchange.publish_memory(
            ...     memory_type="kv_cache",
            ...     kv_cache_data={"keys": [[1,2,3]], "values": [[4,5,6]]},
            ...     price=10.0,
            ...     description="GPT-3.5 conversation memory"
            ... )
            >>> print(result['memory_id'])
        """
        if memory_type not in ['kv_cache', 'reasoning_chain', 'long_term_memory']:
            raise ValidationError(f"Invalid memory_type: {memory_type}")
        
        if price <= 0:
            raise ValidationError("Price must be greater than 0")
        
        payload = {
            'memory_type': memory_type,
            'kv_cache_data': kv_cache_data,
            'price': price
        }
        
        if description:
            payload['description'] = description
        
        return self._request('POST', '/api/v1/memory/publish', json=payload)
    
    def purchase_memory(self, memory_id: int, target_model: str) -> Dict[str, Any]:
        """
        Purchase a memory from the exchange
        
        Args:
            memory_id: ID of the memory to purchase
            target_model: Target model for alignment (e.g., "gpt-4")
            
        Returns:
            Dictionary with transaction_id, memory data, and message
            
        Example:
            >>> result = client.memory_exchange.purchase_memory(
            ...     memory_id=12345,
            ...     target_model="gpt-4"
            ... )
            >>> print(result['memory'])
        """
        payload = {
            'memory_id': memory_id,
            'target_model': target_model
        }
        
        return self._request('POST', '/api/v1/memory/purchase', json=payload)
    
    def browse_memories(
        self,
        memory_type: Optional[str] = None,
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
        limit: int = 20,
        offset: int = 0
    ) -> Dict[str, Any]:
        """
        Browse available memories with filtering
        
        Args:
            memory_type: Filter by memory type
            min_price: Minimum price filter
            max_price: Maximum price filter
            limit: Number of results to return
            offset: Pagination offset
            
        Returns:
            Dictionary with memories list and count
            
        Example:
            >>> result = client.memory_exchange.browse_memories(
            ...     memory_type="kv_cache",
            ...     max_price=50.0,
            ...     limit=10
            ... )
            >>> for memory in result['memories']:
            ...     print(memory['id'], memory['price'])
        """
        params = {
            'limit': limit,
            'offset': offset
        }
        
        if memory_type:
            params['memory_type'] = memory_type
        if min_price is not None:
            params['min_price'] = min_price
        if max_price is not None:
            params['max_price'] = max_price
        
        return self._request('GET', '/api/v1/memory/browse', params=params)
    
    def get_my_history(self, limit: int = 20, offset: int = 0) -> Dict[str, Any]:
        """
        Get user's transaction history
        
        Args:
            limit: Number of results to return
            offset: Pagination offset
            
        Returns:
            Dictionary with transactions list and count
            
        Example:
            >>> result = client.memory_exchange.get_my_history(limit=10)
            >>> for tx in result['transactions']:
            ...     print(tx['id'], tx['status'], tx['price'])
        """
        params = {
            'limit': limit,
            'offset': offset
        }
        
        return self._request('GET', '/api/v1/memory/my-history', params=params)
    
    def publish_reasoning_chain(
        self,
        chain_name: str,
        description: str,
        category: str,
        kv_cache_snapshot: Dict[str, Any],
        source_model: str,
        price_per_use: float,
        input_example: Optional[Dict[str, Any]] = None,
        output_example: Optional[Dict[str, Any]] = None,
        step_count: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Publish a reasoning chain for trading
        
        Args:
            chain_name: Name of the reasoning chain
            description: Detailed description
            category: Category (e.g., "math", "coding", "analysis")
            kv_cache_snapshot: KV-Cache snapshot data
            source_model: Source model (e.g., "gpt-4")
            price_per_use: Price per use in USD
            input_example: Optional input example
            output_example: Optional output example
            step_count: Number of reasoning steps
            
        Returns:
            Dictionary with chain_id and message
            
        Example:
            >>> result = client.memory_exchange.publish_reasoning_chain(
            ...     chain_name="Math Problem Solver",
            ...     description="Step-by-step math reasoning",
            ...     category="math",
            ...     kv_cache_snapshot={"keys": [...], "values": [...]},
            ...     source_model="gpt-4",
            ...     price_per_use=5.0,
            ...     step_count=10
            ... )
            >>> print(result['chain_id'])
        """
        if price_per_use <= 0:
            raise ValidationError("price_per_use must be greater than 0")
        
        payload = {
            'chain_name': chain_name,
            'description': description,
            'category': category,
            'kv_cache_snapshot': kv_cache_snapshot,
            'source_model': source_model,
            'price_per_use': price_per_use
        }
        
        if input_example:
            payload['input_example'] = input_example
        if output_example:
            payload['output_example'] = output_example
        if step_count is not None:
            payload['step_count'] = step_count
        
        return self._request('POST', '/api/v1/reasoning-chain/publish', json=payload)
    
    def use_reasoning_chain(
        self,
        chain_id: int,
        input_data: Dict[str, Any],
        target_model: str
    ) -> Dict[str, Any]:
        """
        Use a reasoning chain (requires purchase or ownership)
        
        Args:
            chain_id: ID of the reasoning chain
            input_data: Input data for the chain
            target_model: Target model for execution
            
        Returns:
            Dictionary with chain data
            
        Example:
            >>> result = client.memory_exchange.use_reasoning_chain(
            ...     chain_id=123,
            ...     input_data={"problem": "2+2=?"},
            ...     target_model="gpt-4"
            ... )
            >>> print(result['chain'])
        """
        payload = {
            'chain_id': chain_id,
            'input_data': input_data,
            'target_model': target_model
        }
        
        return self._request('POST', '/api/v1/reasoning-chain/use', json=payload)
    
    def browse_reasoning_chains(
        self,
        category: Optional[str] = None,
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
        limit: int = 20,
        offset: int = 0
    ) -> Dict[str, Any]:
        """
        Browse available reasoning chains
        
        Args:
            category: Filter by category
            min_price: Minimum price filter
            max_price: Maximum price filter
            limit: Number of results to return
            offset: Pagination offset
            
        Returns:
            Dictionary with chains list and count
            
        Example:
            >>> result = client.memory_exchange.browse_reasoning_chains(
            ...     category="math",
            ...     max_price=10.0
            ... )
            >>> for chain in result['chains']:
            ...     print(chain['chain_name'], chain['price_per_use'])
        """
        params = {
            'limit': limit,
            'offset': offset
        }
        
        if category:
            params['chain_type'] = category  # API uses 'chain_type' parameter
        if min_price is not None:
            params['min_price'] = min_price
        if max_price is not None:
            params['max_price'] = max_price
        
        return self._request('GET', '/api/v1/reasoning-chain/browse', params=params)
    
    def get_stats(self) -> Dict[str, Any]:
        """
        Get marketplace statistics
        
        Returns:
            Dictionary with marketplace stats (total memories, transactions, volume, etc.)
            
        Example:
            >>> stats = client.memory_exchange.get_stats()
            >>> print(f"Total memories: {stats['total_memories']}")
            >>> print(f"Total volume: ${stats['total_volume']}")
        """
        return self._request('GET', '/api/v1/stats')
