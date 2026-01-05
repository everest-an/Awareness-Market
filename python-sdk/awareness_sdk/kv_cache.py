"""
KV-Cache Compression Client for Awareness SDK

Provides production-grade KV-Cache compression capabilities with:
- Model-specific compression adapters
- Performance monitoring and benchmarking
- Quality validation
- Bandwidth estimation

Example:
    >>> from awareness_sdk import AwarenessClient
    >>> 
    >>> client = AwarenessClient(api_key="your_api_key")
    >>> 
    >>> # Compress KV-Cache
    >>> result = client.kv_cache.compress(
    ...     model_name="gpt-4",
    ...     keys=[[1.0, 2.0], [3.0, 4.0]],
    ...     values=[[5.0, 6.0], [7.0, 8.0]],
    ...     queries=[[9.0, 10.0]]
    ... )
    >>> 
    >>> print(f"Compression ratio: {result['metrics']['compressionRatio']}")
    >>> print(f"Bandwidth savings: {result['metrics']['bandwidthSavingsPercent']}%")
"""

from typing import List, Dict, Any, Optional
import requests
from .exceptions import AwarenessAPIError


class KVCacheClient:
    """
    Client for KV-Cache compression operations
    
    Provides access to production-grade KV-Cache compression with:
    - Model-specific adapters for 15+ models
    - Real-time performance metrics
    - Quality validation
    - Bandwidth estimation
    """
    
    def __init__(self, base_url: str, api_key: str, timeout: int = 30):
        """
        Initialize KV-Cache client
        
        Args:
            base_url: Base URL for the API (e.g., "https://awareness.market")
            api_key: API key for authentication
            timeout: Request timeout in seconds
        """
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.timeout = timeout
        self.headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }
    
    def compress(
        self,
        model_name: str,
        keys: List[List[float]],
        values: List[List[float]],
        queries: List[List[float]],
        attention_threshold: Optional[float] = None,
        min_tokens: Optional[int] = None,
        max_tokens: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Compress KV-Cache with model-specific optimization
        
        Args:
            model_name: Model name (e.g., "gpt-4", "claude-3-opus", "llama-3-8b")
            keys: List of key vectors (shape: [num_tokens, key_dim])
            values: List of value vectors (shape: [num_tokens, value_dim])
            queries: List of query vectors (shape: [num_queries, query_dim])
            attention_threshold: Cumulative attention threshold (0-1), default uses model-specific
            min_tokens: Minimum tokens to keep, default: 10
            max_tokens: Maximum tokens to keep, default: 2048
            
        Returns:
            Dictionary containing:
                - compressed: Compressed KV-Cache data
                - metrics: Performance metrics (compression time, bandwidth savings, etc.)
                
        Raises:
            AwarenessAPIError: If compression fails
            
        Example:
            >>> result = client.kv_cache.compress(
            ...     model_name="gpt-4",
            ...     keys=[[1.0, 2.0, 3.0], [4.0, 5.0, 6.0]],
            ...     values=[[7.0, 8.0, 9.0], [10.0, 11.0, 12.0]],
            ...     queries=[[13.0, 14.0, 15.0]]
            ... )
            >>> 
            >>> print(f"Original tokens: {result['metrics']['totalTokens']}")
            >>> print(f"Selected tokens: {result['metrics']['selectedTokens']}")
            >>> print(f"Bandwidth savings: {result['metrics']['bandwidthSavingsPercent']:.2f}%")
        """
        payload = {
            'modelName': model_name,
            'keys': keys,
            'values': values,
            'queries': queries,
        }
        
        # Add optional parameters
        options = {}
        if attention_threshold is not None:
            options['attentionThreshold'] = attention_threshold
        if min_tokens is not None:
            options['minTokens'] = min_tokens
        if max_tokens is not None:
            options['maxTokens'] = max_tokens
        
        if options:
            payload['options'] = options
        
        try:
            response = requests.post(
                f"{self.base_url}/api/trpc/kvCacheApi.compress",
                json={'json': payload},
                headers=self.headers,
                timeout=self.timeout
            )
            response.raise_for_status()
            
            data = response.json()
            if 'result' in data and 'data' in data['result']:
                return data['result']['data']
            else:
                raise AwarenessAPIError(f"Unexpected response format: {data}")
                
        except requests.exceptions.RequestException as e:
            raise AwarenessAPIError(f"Compression failed: {str(e)}")
    
    def decompress(
        self,
        compressed: Dict[str, Any],
        original_length: int
    ) -> Dict[str, List[List[float]]]:
        """
        Decompress KV-Cache back to original size
        
        Args:
            compressed: Compressed KV-Cache data (from compress())
            original_length: Original number of tokens
            
        Returns:
            Dictionary containing:
                - keys: Decompressed key vectors
                - values: Decompressed value vectors
                
        Example:
            >>> # First compress
            >>> result = client.kv_cache.compress(...)
            >>> compressed = result['compressed']
            >>> 
            >>> # Then decompress
            >>> decompressed = client.kv_cache.decompress(
            ...     compressed=compressed,
            ...     original_length=100
            ... )
            >>> 
            >>> keys = decompressed['keys']
            >>> values = decompressed['values']
        """
        payload = {
            'compressed': compressed,
            'originalLength': original_length
        }
        
        try:
            response = requests.post(
                f"{self.base_url}/api/trpc/kvCacheApi.decompress",
                json={'json': payload},
                headers=self.headers,
                timeout=self.timeout
            )
            response.raise_for_status()
            
            data = response.json()
            if 'result' in data and 'data' in data['result']:
                return data['result']['data']
            else:
                raise AwarenessAPIError(f"Unexpected response format: {data}")
                
        except requests.exceptions.RequestException as e:
            raise AwarenessAPIError(f"Decompression failed: {str(e)}")
    
    def validate_quality(
        self,
        model_name: str,
        compressed: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Validate compression quality
        
        Args:
            model_name: Model name used for compression
            compressed: Compressed KV-Cache data
            
        Returns:
            Dictionary containing:
                - passed: Whether quality check passed
                - attentionCoverage: Cumulative attention coverage (0-1)
                - informationLoss: Estimated information loss (0-1)
                - recommendations: List of optimization suggestions
                - warnings: List of quality warnings
                
        Example:
            >>> result = client.kv_cache.compress(...)
            >>> quality = client.kv_cache.validate_quality(
            ...     model_name="gpt-4",
            ...     compressed=result['compressed']
            ... )
            >>> 
            >>> if quality['passed']:
            ...     print("✓ Quality check passed")
            ... else:
            ...     print("✗ Quality issues detected:")
            ...     for warning in quality['warnings']:
            ...         print(f"  - {warning}")
        """
        payload = {
            'modelName': model_name,
            'compressed': compressed
        }
        
        try:
            response = requests.get(
                f"{self.base_url}/api/trpc/kvCacheApi.validateQuality",
                params={'input': requests.utils.quote(str(payload))},
                headers=self.headers,
                timeout=self.timeout
            )
            response.raise_for_status()
            
            data = response.json()
            if 'result' in data and 'data' in data['result']:
                return data['result']['data']['quality']
            else:
                raise AwarenessAPIError(f"Unexpected response format: {data}")
                
        except requests.exceptions.RequestException as e:
            raise AwarenessAPIError(f"Quality validation failed: {str(e)}")
    
    def benchmark(
        self,
        model_name: str,
        num_tokens: int = 100,
        dimension: int = 128,
        iterations: int = 10
    ) -> Dict[str, Any]:
        """
        Run compression benchmark
        
        Args:
            model_name: Model name to benchmark
            num_tokens: Number of tokens to test
            dimension: Vector dimension
            iterations: Number of iterations for averaging
            
        Returns:
            Dictionary containing benchmark results:
                - compressionTimeMs: Average compression time
                - decompressionTimeMs: Average decompression time
                - compressionRatio: Compression ratio
                - bandwidthSavingsPercent: Bandwidth savings percentage
                - attentionCoverage: Attention coverage
                - qualityPassed: Whether quality check passed
                
        Example:
            >>> result = client.kv_cache.benchmark(
            ...     model_name="gpt-4",
            ...     num_tokens=200,
            ...     dimension=256,
            ...     iterations=5
            ... )
            >>> 
            >>> print(f"Avg compression time: {result['compressionTimeMs']:.2f}ms")
            >>> print(f"Bandwidth savings: {result['bandwidthSavingsPercent']:.2f}%")
        """
        payload = {
            'modelName': model_name,
            'numTokens': num_tokens,
            'dimension': dimension,
            'iterations': iterations
        }
        
        try:
            response = requests.post(
                f"{self.base_url}/api/trpc/kvCacheApi.benchmark",
                json={'json': payload},
                headers=self.headers,
                timeout=self.timeout * 2  # Benchmarks take longer
            )
            response.raise_for_status()
            
            data = response.json()
            if 'result' in data and 'data' in data['result']:
                return data['result']['data']['result']
            else:
                raise AwarenessAPIError(f"Unexpected response format: {data}")
                
        except requests.exceptions.RequestException as e:
            raise AwarenessAPIError(f"Benchmark failed: {str(e)}")
    
    def get_supported_models(self) -> List[Dict[str, Any]]:
        """
        Get list of supported models and their adapters
        
        Returns:
            List of model configurations with:
                - name: Model name
                - family: Model family (gpt, claude, llama, etc.)
                - attentionType: Attention mechanism type
                - recommendedThreshold: Recommended attention threshold
                
        Example:
            >>> models = client.kv_cache.get_supported_models()
            >>> 
            >>> for model in models:
            ...     print(f"{model['name']}: {model['attentionType']} attention")
            >>> 
            >>> # Find GPT models
            >>> gpt_models = [m for m in models if m['family'] == 'gpt']
        """
        try:
            response = requests.get(
                f"{self.base_url}/api/trpc/kvCacheApi.getSupportedModels",
                headers=self.headers,
                timeout=self.timeout
            )
            response.raise_for_status()
            
            data = response.json()
            if 'result' in data and 'data' in data['result']:
                return data['result']['data']['models']
            else:
                raise AwarenessAPIError(f"Unexpected response format: {data}")
                
        except requests.exceptions.RequestException as e:
            raise AwarenessAPIError(f"Failed to get supported models: {str(e)}")
    
    def get_model_adapter(self, model_name: str) -> Dict[str, Any]:
        """
        Get adapter configuration for a specific model
        
        Args:
            model_name: Model name
            
        Returns:
            Dictionary containing adapter configuration:
                - modelFamily: Model family
                - attentionType: Attention mechanism type
                - recommendedThreshold: Recommended threshold
                - windowSize: Window size (for sliding-window attention)
                - sparsityPattern: Sparsity pattern (for sparse attention)
                
        Example:
            >>> adapter = client.kv_cache.get_model_adapter("mistral-7b")
            >>> 
            >>> print(f"Attention type: {adapter['attentionType']}")
            >>> print(f"Window size: {adapter['windowSize']}")
            >>> print(f"Recommended threshold: {adapter['recommendedThreshold']}")
        """
        try:
            response = requests.get(
                f"{self.base_url}/api/trpc/kvCacheApi.getModelAdapter",
                params={'input': requests.utils.quote(f'{{"modelName":"{model_name}"}}')},
                headers=self.headers,
                timeout=self.timeout
            )
            response.raise_for_status()
            
            data = response.json()
            if 'result' in data and 'data' in data['result']:
                return data['result']['data']['adapter']
            else:
                raise AwarenessAPIError(f"Unexpected response format: {data}")
                
        except requests.exceptions.RequestException as e:
            raise AwarenessAPIError(f"Failed to get model adapter: {str(e)}")
    
    def estimate_savings(
        self,
        model_name: str,
        num_tokens: int,
        dimension: int,
        attention_threshold: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Estimate bandwidth savings without actual compression
        
        Args:
            model_name: Model name
            num_tokens: Number of tokens
            dimension: Vector dimension
            attention_threshold: Optional custom threshold
            
        Returns:
            Dictionary containing estimates:
                - compressionRatio: Estimated compression ratio
                - tokenSavings: Estimated token savings
                - bandwidthSavingsBytes: Estimated bytes saved
                - bandwidthSavingsPercent: Estimated percentage saved
                - estimatedAttentionCoverage: Estimated attention coverage
                
        Example:
            >>> estimate = client.kv_cache.estimate_savings(
            ...     model_name="gpt-4",
            ...     num_tokens=1000,
            ...     dimension=512
            ... )
            >>> 
            >>> print(f"Estimated savings: {estimate['bandwidthSavingsPercent']:.2f}%")
            >>> print(f"Tokens saved: {estimate['tokenSavings']}")
        """
        params = {
            'modelName': model_name,
            'numTokens': num_tokens,
            'dimension': dimension
        }
        
        if attention_threshold is not None:
            params['attentionThreshold'] = attention_threshold
        
        try:
            response = requests.get(
                f"{self.base_url}/api/trpc/kvCacheApi.estimateSavings",
                params={'input': requests.utils.quote(str(params))},
                headers=self.headers,
                timeout=self.timeout
            )
            response.raise_for_status()
            
            data = response.json()
            if 'result' in data and 'data' in data['result']:
                return data['result']['data']['estimate']
            else:
                raise AwarenessAPIError(f"Unexpected response format: {data}")
                
        except requests.exceptions.RequestException as e:
            raise AwarenessAPIError(f"Failed to estimate savings: {str(e)}")
    
    def get_compression_stats(self, model_name: str) -> Dict[str, Any]:
        """
        Get compression statistics for a model
        
        Args:
            model_name: Model name
            
        Returns:
            Dictionary containing statistics:
                - avgCompressionTimeMs: Average compression time
                - avgDecompressionTimeMs: Average decompression time
                - avgCompressionRatio: Average compression ratio
                - avgBandwidthSavings: Average bandwidth savings
                - avgAttentionCoverage: Average attention coverage
                - qualityPassed: Whether quality checks pass
                
        Example:
            >>> stats = client.kv_cache.get_compression_stats("gpt-4")
            >>> 
            >>> print(f"Model: {stats['modelName']}")
            >>> print(f"Avg compression time: {stats['avgCompressionTimeMs']:.2f}ms")
            >>> print(f"Avg bandwidth savings: {stats['avgBandwidthSavings']:.2f}%")
        """
        try:
            response = requests.get(
                f"{self.base_url}/api/trpc/kvCacheApi.getCompressionStats",
                params={'input': requests.utils.quote(f'{{"modelName":"{model_name}"}}')},
                headers=self.headers,
                timeout=self.timeout * 2  # Stats calculation takes time
            )
            response.raise_for_status()
            
            data = response.json()
            if 'result' in data and 'data' in data['result']:
                return data['result']['data']['stats']
            else:
                raise AwarenessAPIError(f"Unexpected response format: {data}")
                
        except requests.exceptions.RequestException as e:
            raise AwarenessAPIError(f"Failed to get compression stats: {str(e)}")
