"""
Awareness Market - Three Product Lines Example
===============================================

This example demonstrates how to interact with the three product lines:
1. Vector Packages - AI capability trading
2. Memory Packages - KV-Cache memory transplant
3. Chain Packages - Reasoning chain trading

Requirements:
    pip install requests

Usage:
    python three_product_lines_example.py
"""

import requests
import json
from typing import Dict, List, Optional

# API Base URL
BASE_URL = "http://localhost:3000"


class AwarenessMarketClient:
    """Client for interacting with Awareness Market Three Product Lines"""
    
    def __init__(self, api_key: str, base_url: str = BASE_URL):
        self.base_url = base_url
        self.api_key = api_key
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        })
    
    def _trpc_call(self, procedure: str, input_data: Dict) -> Dict:
        """Make a tRPC API call"""
        response = self.session.post(
            f"{self.base_url}/api/trpc/{procedure}",
            json=input_data
        )
        response.raise_for_status()
        return response.json()
    
    # ========== Vector Packages (Capability Trading) ==========
    
    def search_vector_packages(
        self,
        category: Optional[str] = None,
        source_model: Optional[str] = None,
        target_model: Optional[str] = None,
        min_quality: int = 70,
        limit: int = 10
    ) -> List[Dict]:
        """
        Search for Vector Packages (AI capability trading)
        
        Args:
            category: Package category (nlp, vision, audio, multimodal, other)
            source_model: Source model identifier
            target_model: Target model identifier
            min_quality: Minimum quality score (0-100)
            limit: Maximum number of results
            
        Returns:
            List of matching vector packages
        """
        result = self._trpc_call("packages.browsePackages", {
            "packageType": "vector",
            "category": category,
            "sourceModel": source_model,
            "targetModel": target_model,
            "minQuality": min_quality,
            "limit": limit,
            "offset": 0
        })
        
        packages = result.get("result", {}).get("data", {}).get("packages", [])
        print(f"✓ Found {len(packages)} vector packages")
        return packages
    
    # ========== Memory Packages (KV-Cache Transfer) ==========
    
    def search_memory_packages(
        self,
        source_model: Optional[str] = None,
        target_model: Optional[str] = None,
        min_quality: int = 70,
        limit: int = 10
    ) -> List[Dict]:
        """
        Search for Memory Packages (KV-Cache memory transplant)
        
        Args:
            source_model: Source model identifier
            target_model: Target model identifier
            min_quality: Minimum quality score (0-100)
            limit: Maximum number of results
            
        Returns:
            List of matching memory packages
        """
        result = self._trpc_call("packages.browsePackages", {
            "packageType": "memory",
            "sourceModel": source_model,
            "targetModel": target_model,
            "minQuality": min_quality,
            "limit": limit,
            "offset": 0
        })
        
        packages = result.get("result", {}).get("data", {}).get("packages", [])
        print(f"✓ Found {len(packages)} memory packages")
        return packages
    
    # ========== Chain Packages (Reasoning Chain Trading) ==========
    
    def search_chain_packages(
        self,
        problem_type: Optional[str] = None,
        source_model: Optional[str] = None,
        target_model: Optional[str] = None,
        min_quality: int = 70,
        limit: int = 10
    ) -> List[Dict]:
        """
        Search for Chain Packages (reasoning chain trading)
        
        Args:
            problem_type: Type of problem (math-proof, code-generation, etc.)
            source_model: Source model identifier
            target_model: Target model identifier
            min_quality: Minimum quality score (0-100)
            limit: Maximum number of results
            
        Returns:
            List of matching chain packages
        """
        result = self._trpc_call("packages.browsePackages", {
            "packageType": "chain",
            "problemType": problem_type,
            "sourceModel": source_model,
            "targetModel": target_model,
            "minQuality": min_quality,
            "limit": limit,
            "offset": 0
        })
        
        packages = result.get("result", {}).get("data", {}).get("packages", [])
        print(f"✓ Found {len(packages)} chain packages")
        return packages
    
    # ========== Purchase & Download ==========
    
    def purchase_package(self, package_type: str, package_id: str) -> Dict:
        """
        Purchase a package
        
        Args:
            package_type: Type of package (vector, memory, chain)
            package_id: Package identifier
            
        Returns:
            Purchase confirmation
        """
        result = self._trpc_call("packages.purchasePackage", {
            "packageType": package_type,
            "packageId": package_id
        })
        
        print(f"✓ Purchased {package_type} package: {package_id}")
        return result.get("result", {}).get("data", {})
    
    def download_package(self, package_type: str, package_id: str) -> str:
        """
        Download a purchased package
        
        Args:
            package_type: Type of package (vector, memory, chain)
            package_id: Package identifier
            
        Returns:
            Download URL
        """
        result = self._trpc_call("packages.downloadPackage", {
            "packageType": package_type,
            "packageId": package_id
        })
        
        url = result.get("result", {}).get("data", {}).get("packageUrl", "")
        print(f"✓ Download URL generated for {package_id}")
        return url
    
    # ========== W-Matrix Compatibility ==========
    
    def check_compatibility(self, source_model: str, target_model: str) -> Dict:
        """
        Check W-Matrix compatibility between two models
        
        Args:
            source_model: Source model identifier
            target_model: Target model identifier
            
        Returns:
            Compatibility information
        """
        result = self._trpc_call("wMatrixMarketplaceV2.getCompatibleModels", {
            "sourceModel": source_model
        })
        
        compatible_models = result.get("result", {}).get("data", {}).get("compatibleModels", [])
        
        for model in compatible_models:
            if model.get("targetModel") == target_model:
                print(f"✓ Models are compatible (epsilon: {model.get('epsilon')})")
                return {
                    "compatible": True,
                    "epsilon": model.get("epsilon"),
                    "informationRetention": model.get("informationRetention")
                }
        
        print(f"✗ Models are not compatible")
        return {"compatible": False}


def main():
    """Example usage of the Three Product Lines API"""
    
    # Initialize client (replace with your API key)
    api_key = "your_api_key_here"
    client = AwarenessMarketClient(api_key=api_key)
    
    print("=" * 60)
    print("Awareness Market - Three Product Lines Demo")
    print("=" * 60)
    
    # ========== 1. Vector Packages ==========
    print("\n" + "=" * 40)
    print("1. VECTOR PACKAGES (Capability Trading)")
    print("=" * 40)
    
    print("\nSearching for NLP capability vectors...")
    vectors = client.search_vector_packages(
        category="nlp",
        source_model="gpt-4",
        target_model="llama-3.1-70b",
        min_quality=80
    )
    
    if vectors:
        print("\nTop Vector Packages:")
        for i, pkg in enumerate(vectors[:3], 1):
            print(f"\n  {i}. {pkg.get('name', 'Unknown')}")
            print(f"     Category: {pkg.get('category', 'N/A')}")
            print(f"     Price: ${pkg.get('price', 'N/A')}")
            print(f"     Rating: {pkg.get('rating', 'N/A')}⭐")
    
    # ========== 2. Memory Packages ==========
    print("\n" + "=" * 40)
    print("2. MEMORY PACKAGES (KV-Cache Transfer)")
    print("=" * 40)
    
    print("\nSearching for memory packages...")
    memories = client.search_memory_packages(
        source_model="claude-3-opus",
        target_model="gpt-4o",
        min_quality=85
    )
    
    if memories:
        print("\nTop Memory Packages:")
        for i, pkg in enumerate(memories[:3], 1):
            print(f"\n  {i}. {pkg.get('name', 'Unknown')}")
            print(f"     Token Count: {pkg.get('tokenCount', 'N/A')}")
            print(f"     Compression: {pkg.get('compressionRatio', 'N/A')}")
            print(f"     Price: ${pkg.get('price', 'N/A')}")
    
    # ========== 3. Chain Packages ==========
    print("\n" + "=" * 40)
    print("3. CHAIN PACKAGES (Reasoning Chain Trading)")
    print("=" * 40)
    
    print("\nSearching for code-generation reasoning chains...")
    chains = client.search_chain_packages(
        problem_type="code-generation",
        min_quality=80
    )
    
    if chains:
        print("\nTop Chain Packages:")
        for i, pkg in enumerate(chains[:3], 1):
            print(f"\n  {i}. {pkg.get('name', 'Unknown')}")
            print(f"     Problem Type: {pkg.get('problemType', 'N/A')}")
            print(f"     Steps: {pkg.get('stepCount', 'N/A')}")
            print(f"     Quality: {pkg.get('solutionQuality', 'N/A')}")
            print(f"     Price: ${pkg.get('price', 'N/A')}")
    
    # ========== 4. Check Compatibility ==========
    print("\n" + "=" * 40)
    print("4. W-MATRIX COMPATIBILITY CHECK")
    print("=" * 40)
    
    print("\nChecking compatibility: GPT-4 → LLaMA-3.1-70B...")
    compat = client.check_compatibility("gpt-4", "llama-3.1-70b")
    
    if compat.get("compatible"):
        print(f"  ✓ Compatible!")
        print(f"  Epsilon: {compat.get('epsilon')}")
        print(f"  Information Retention: {compat.get('informationRetention')}")
    
    # ========== 5. Purchase & Download (Example) ==========
    print("\n" + "=" * 40)
    print("5. PURCHASE & DOWNLOAD (Example)")
    print("=" * 40)
    
    print("\nNote: Uncomment the code below to test purchase/download")
    print("      Requires valid API key and package ID")
    
    # Example purchase flow:
    # if vectors:
    #     package_id = vectors[0].get("packageId")
    #     
    #     # Purchase
    #     purchase = client.purchase_package("vector", package_id)
    #     print(f"Purchase ID: {purchase.get('id')}")
    #     
    #     # Download
    #     download_url = client.download_package("vector", package_id)
    #     print(f"Download URL: {download_url}")
    
    print("\n" + "=" * 60)
    print("✅ Demo completed successfully!")
    print("=" * 60)


if __name__ == "__main__":
    main()
