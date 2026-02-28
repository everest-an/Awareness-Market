"""
Awareness SDK - Python client for Neural Bridge Awareness Marketplace

This SDK provides a unified interface to interact with:
- Vector Packages (.vectorpkg) - Static AI capabilities
- Memory Packages (.memorypkg) - KV-Cache for context transfer
- Chain Packages (.chainpkg) - Reasoning chains
- Memory Exchange Service (KV-Cache trading)
- W-Matrix Marketplace Service (alignment tools)
- KV-Cache Compression Service (production-grade compression)

Example:
    >>> from awareness_sdk import AwarenessClient
    >>> client = AwarenessClient(api_key="your_api_key")
    >>> 
    >>> # Search vector packages
    >>> vectors = client.vector_packages.search(category="nlp")
    >>> 
    >>> # Search memory packages
    >>> memories = client.memory_packages.search(source_model="gpt-4")
    >>> 
    >>> # Search chain packages
    >>> chains = client.chain_packages.search(problem_type="code-generation")
    >>> 
    >>> # Purchase and download
    >>> client.vector_packages.purchase("vpkg_abc123")
    >>> url = client.vector_packages.download("vpkg_abc123")
"""

__version__ = "1.1.0"
__author__ = "Awareness Market Team"
__email__ = "support@awareness.market"

from .client import AwarenessClient
from .memory_exchange import MemoryExchangeClient
from .w_matrix import WMatrixClient
from .kv_cache import KVCacheClient
from .packages import VectorPackageClient, MemoryPackageClient, ChainPackageClient
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
    "VectorPackageClient",
    "MemoryPackageClient",
    "ChainPackageClient",
    "AwarenessSDKError",
    "AuthenticationError",
    "APIError",
    "ValidationError",
    "NotFoundError",
]
