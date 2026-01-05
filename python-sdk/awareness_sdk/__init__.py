"""
Awareness SDK - Python client for LatentMAS Awareness Marketplace

This SDK provides a unified interface to interact with:
- Memory Exchange Service (KV-Cache trading)
- W-Matrix Marketplace Service (alignment tools)
- KV-Cache Compression Service (production-grade compression)

Example:
    >>> from awareness_sdk import AwarenessClient
    >>> client = AwarenessClient(api_key="your_api_key")
    >>> 
    >>> # Publish a memory
    >>> result = client.memory_exchange.publish(
    ...     memory_type="kv_cache",
    ...     kv_cache_data={"keys": [...], "values": [...]},
    ...     price=10.0
    ... )
    >>> 
    >>> # Browse W-Matrix listings
    >>> listings = client.w_matrix.browse(
    ...     source_model="gpt-3.5",
    ...     target_model="gpt-4"
    ... )
"""

__version__ = "1.0.0"
__author__ = "Awareness Market Team"
__email__ = "support@awareness.market"

from .client import AwarenessClient
from .memory_exchange import MemoryExchangeClient
from .w_matrix import WMatrixClient
from .kv_cache import KVCacheClient
from .exceptions import (
    AwarenessSDKError,
    AuthenticationError,
    APIError,
    ValidationError,
    NotFoundError,
)

__all__ = [
    "AwarenessClient",
    "MemoryExchangeClient",
    "WMatrixClient",
    "KVCacheClient",
    "AwarenessSDKError",
    "AuthenticationError",
    "APIError",
    "ValidationError",
    "NotFoundError",
]
