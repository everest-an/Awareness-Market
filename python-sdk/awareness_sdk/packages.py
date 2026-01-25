"""
Package Clients for Three Product Lines

Provides dedicated clients for:
- Vector Packages (.vectorpkg) - Static AI capabilities
- Memory Packages (.memorypkg) - KV-Cache for context transfer
- Chain Packages (.chainpkg) - Reasoning chains
"""

import requests
from typing import Optional, List, Dict, Any
from .exceptions import APIError, ValidationError


class BasePackageClient:
    """Base client for package operations"""
    
    def __init__(self, base_url: str, api_key: str, timeout: int = 30):
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.timeout = timeout
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
    
    def _request(self, method: str, endpoint: str, data: dict = None) -> dict:
        """Make API request"""
        url = f"{self.base_url}{endpoint}"
        try:
            if method == "GET":
                response = requests.get(url, headers=self.headers, params=data, timeout=self.timeout)
            else:
                response = requests.post(url, headers=self.headers, json=data, timeout=self.timeout)
            
            if not response.ok:
                raise APIError(f"API request failed: {response.status_code} {response.text}")
            
            return response.json()
        except requests.RequestException as e:
            raise APIError(f"Request failed: {str(e)}")


class VectorPackageClient(BasePackageClient):
    """
    Client for Vector Package operations
    
    Vector Packages contain static AI capabilities/embeddings that can be
    transferred between models using W-Matrix transformation.
    
    Example:
        >>> from awareness_sdk import AwarenessClient
        >>> client = AwarenessClient(api_key="your_key")
        >>> 
        >>> # Search for NLP vectors
        >>> vectors = client.vector_packages.search(category="nlp")
        >>> 
        >>> # Purchase and download
        >>> client.vector_packages.purchase("vpkg_abc123")
        >>> url = client.vector_packages.download("vpkg_abc123")
    """
    
    def search(
        self,
        category: Optional[str] = None,
        source_model: Optional[str] = None,
        target_model: Optional[str] = None,
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
        search: Optional[str] = None,
        sort_by: str = "recent",
        limit: int = 20,
        offset: int = 0
    ) -> Dict[str, Any]:
        """
        Search for vector packages
        
        Args:
            category: Filter by category (nlp, vision, audio, multimodal, other)
            source_model: Filter by source model
            target_model: Filter by target model
            min_price: Minimum price filter
            max_price: Maximum price filter
            search: Text search in name/description
            sort_by: Sort order (recent, popular, price_asc, price_desc)
            limit: Max results (default 20)
            offset: Pagination offset
            
        Returns:
            Dict with packages list and total count
        """
        return self._request("POST", "/api/trpc/packages.browsePackages", {
            "packageType": "vector",
            "category": category,
            "sourceModel": source_model,
            "targetModel": target_model,
            "minPrice": min_price,
            "maxPrice": max_price,
            "search": search,
            "sortBy": sort_by,
            "limit": limit,
            "offset": offset
        })
    
    def get(self, package_id: str) -> Dict[str, Any]:
        """Get vector package details"""
        return self._request("POST", "/api/trpc/packages.getPackage", {
            "packageType": "vector",
            "packageId": package_id
        })
    
    def purchase(self, package_id: str) -> Dict[str, Any]:
        """Purchase a vector package"""
        return self._request("POST", "/api/trpc/packages.purchasePackage", {
            "packageType": "vector",
            "packageId": package_id
        })
    
    def download(self, package_id: str) -> str:
        """Get download URL for purchased package"""
        result = self._request("POST", "/api/trpc/packages.downloadPackage", {
            "packageType": "vector",
            "packageId": package_id
        })
        return result.get("result", {}).get("data", {}).get("packageUrl", "")
    
    def my_packages(self) -> List[Dict[str, Any]]:
        """List packages created by current user"""
        result = self._request("POST", "/api/trpc/packages.myPackages", {
            "packageType": "vector"
        })
        return result.get("result", {}).get("data", {}).get("packages", [])


class MemoryPackageClient(BasePackageClient):
    """
    Client for Memory Package operations
    
    Memory Packages contain KV-Cache data that enables cross-model
    context transfer using the LatentMAS protocol.
    
    Example:
        >>> from awareness_sdk import AwarenessClient
        >>> client = AwarenessClient(api_key="your_key")
        >>> 
        >>> # Search for GPT-4 to Claude memories
        >>> memories = client.memory_packages.search(
        ...     source_model="gpt-4",
        ...     target_model="claude-3-opus"
        ... )
        >>> 
        >>> # Purchase and download
        >>> client.memory_packages.purchase("mpkg_abc123")
        >>> url = client.memory_packages.download("mpkg_abc123")
    """
    
    def search(
        self,
        source_model: Optional[str] = None,
        target_model: Optional[str] = None,
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
        search: Optional[str] = None,
        sort_by: str = "recent",
        limit: int = 20,
        offset: int = 0
    ) -> Dict[str, Any]:
        """
        Search for memory packages
        
        Args:
            source_model: Filter by source model
            target_model: Filter by target model
            min_price: Minimum price filter
            max_price: Maximum price filter
            search: Text search in name/description
            sort_by: Sort order (recent, popular, price_asc, price_desc)
            limit: Max results (default 20)
            offset: Pagination offset
            
        Returns:
            Dict with packages list and total count
        """
        return self._request("POST", "/api/trpc/packages.browsePackages", {
            "packageType": "memory",
            "sourceModel": source_model,
            "targetModel": target_model,
            "minPrice": min_price,
            "maxPrice": max_price,
            "search": search,
            "sortBy": sort_by,
            "limit": limit,
            "offset": offset
        })
    
    def get(self, package_id: str) -> Dict[str, Any]:
        """Get memory package details"""
        return self._request("POST", "/api/trpc/packages.getPackage", {
            "packageType": "memory",
            "packageId": package_id
        })
    
    def purchase(self, package_id: str) -> Dict[str, Any]:
        """Purchase a memory package"""
        return self._request("POST", "/api/trpc/packages.purchasePackage", {
            "packageType": "memory",
            "packageId": package_id
        })
    
    def download(self, package_id: str) -> str:
        """Get download URL for purchased package"""
        result = self._request("POST", "/api/trpc/packages.downloadPackage", {
            "packageType": "memory",
            "packageId": package_id
        })
        return result.get("result", {}).get("data", {}).get("packageUrl", "")
    
    def my_packages(self) -> List[Dict[str, Any]]:
        """List packages created by current user"""
        result = self._request("POST", "/api/trpc/packages.myPackages", {
            "packageType": "memory"
        })
        return result.get("result", {}).get("data", {}).get("packages", [])


class ChainPackageClient(BasePackageClient):
    """
    Client for Chain Package operations
    
    Chain Packages contain reasoning chains that capture step-by-step
    problem-solving processes for transfer between models.
    
    Example:
        >>> from awareness_sdk import AwarenessClient
        >>> client = AwarenessClient(api_key="your_key")
        >>> 
        >>> # Search for math reasoning chains
        >>> chains = client.chain_packages.search(problem_type="mathematical-proof")
        >>> 
        >>> # Purchase and download
        >>> client.chain_packages.purchase("cpkg_abc123")
        >>> url = client.chain_packages.download("cpkg_abc123")
    """
    
    def search(
        self,
        problem_type: Optional[str] = None,
        source_model: Optional[str] = None,
        target_model: Optional[str] = None,
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
        search: Optional[str] = None,
        sort_by: str = "recent",
        limit: int = 20,
        offset: int = 0
    ) -> Dict[str, Any]:
        """
        Search for chain packages
        
        Args:
            problem_type: Filter by problem type (math-proof, code-generation, etc.)
            source_model: Filter by source model
            target_model: Filter by target model
            min_price: Minimum price filter
            max_price: Maximum price filter
            search: Text search in name/description
            sort_by: Sort order (recent, popular, price_asc, price_desc)
            limit: Max results (default 20)
            offset: Pagination offset
            
        Returns:
            Dict with packages list and total count
        """
        return self._request("POST", "/api/trpc/packages.browsePackages", {
            "packageType": "chain",
            "problemType": problem_type,
            "sourceModel": source_model,
            "targetModel": target_model,
            "minPrice": min_price,
            "maxPrice": max_price,
            "search": search,
            "sortBy": sort_by,
            "limit": limit,
            "offset": offset
        })
    
    def get(self, package_id: str) -> Dict[str, Any]:
        """Get chain package details"""
        return self._request("POST", "/api/trpc/packages.getPackage", {
            "packageType": "chain",
            "packageId": package_id
        })
    
    def purchase(self, package_id: str) -> Dict[str, Any]:
        """Purchase a chain package"""
        return self._request("POST", "/api/trpc/packages.purchasePackage", {
            "packageType": "chain",
            "packageId": package_id
        })
    
    def download(self, package_id: str) -> str:
        """Get download URL for purchased package"""
        result = self._request("POST", "/api/trpc/packages.downloadPackage", {
            "packageType": "chain",
            "packageId": package_id
        })
        return result.get("result", {}).get("data", {}).get("packageUrl", "")
    
    def my_packages(self) -> List[Dict[str, Any]]:
        """List packages created by current user"""
        result = self._request("POST", "/api/trpc/packages.myPackages", {
            "packageType": "chain"
        })
        return result.get("result", {}).get("data", {}).get("packages", [])
