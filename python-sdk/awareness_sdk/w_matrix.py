"""
W-Matrix Marketplace Client - Alignment tools and cross-model transformation
"""

import requests
from typing import Dict, List, Optional, Any
from .exceptions import APIError, ValidationError, NotFoundError, NetworkError


class WMatrixClient:
    """
    Client for W-Matrix Marketplace Service (port 8081)
    
    Provides methods for:
    - Creating W-Matrix listings
    - Browsing W-Matrix listings
    - Purchasing W-Matrix alignment tools
    """
    
    def __init__(self, base_url: str, api_key: str, timeout: int = 30):
        """
        Initialize W-Matrix Marketplace client
        
        Args:
            base_url: Base URL of W-Matrix service (e.g., "http://localhost:8081")
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
        Make HTTP request to W-Matrix API
        
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
    
    def create_listing(
        self,
        title: str,
        description: str,
        source_model: str,
        target_model: str,
        source_dim: int,
        target_dim: int,
        price: float,
        alignment_loss: float,
        training_data_size: int
    ) -> Dict[str, Any]:
        """
        Create a new W-Matrix listing
        
        Args:
            title: Listing title
            description: Detailed description
            source_model: Source model name (e.g., "gpt-3.5")
            target_model: Target model name (e.g., "gpt-4")
            source_dim: Source dimension (e.g., 4096)
            target_dim: Target dimension (e.g., 8192)
            price: Price in USD
            alignment_loss: Alignment loss metric (lower is better)
            training_data_size: Number of training samples used
            
        Returns:
            Dictionary with listing_id and matrix_id
            
        Example:
            >>> result = client.w_matrix.create_listing(
            ...     title="GPT-3.5 to GPT-4 Alignment",
            ...     description="High-quality W-Matrix for GPT-3.5 → GPT-4",
            ...     source_model="gpt-3.5",
            ...     target_model="gpt-4",
            ...     source_dim=4096,
            ...     target_dim=8192,
            ...     price=100.0,
            ...     alignment_loss=0.001,
            ...     training_data_size=10000
            ... )
            >>> print(result['listing_id'])
        """
        if price <= 0:
            raise ValidationError("Price must be greater than 0")
        
        if alignment_loss < 0:
            raise ValidationError("Alignment loss cannot be negative")
        
        if training_data_size <= 0:
            raise ValidationError("Training data size must be greater than 0")
        
        payload = {
            'title': title,
            'description': description,
            'source_model': source_model,
            'target_model': target_model,
            'source_dim': source_dim,
            'target_dim': target_dim,
            'price': price,
            'alignment_loss': alignment_loss,
            'training_data_size': training_data_size
        }
        
        return self._request('POST', '/api/v1/listings', json=payload)
    
    def browse_listings(
        self,
        source_model: Optional[str] = None,
        target_model: Optional[str] = None,
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
        sort_by: str = "newest",
        limit: int = 20,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Browse W-Matrix listings with filtering and sorting
        
        Args:
            source_model: Filter by source model
            target_model: Filter by target model
            min_price: Minimum price filter
            max_price: Maximum price filter
            sort_by: Sort order (newest, price_asc, price_desc, rating, sales)
            limit: Number of results to return
            offset: Pagination offset
            
        Returns:
            List of W-Matrix listings
            
        Example:
            >>> listings = client.w_matrix.browse_listings(
            ...     source_model="gpt-3.5",
            ...     target_model="gpt-4",
            ...     sort_by="rating",
            ...     limit=10
            ... )
            >>> for listing in listings:
            ...     print(listing['title'], listing['price'], listing['average_rating'])
        """
        params = {
            'sort_by': sort_by,
            'limit': limit,
            'offset': offset
        }
        
        if source_model:
            params['source_model'] = source_model
        if target_model:
            params['target_model'] = target_model
        if min_price is not None:
            params['min_price'] = min_price
        if max_price is not None:
            params['max_price'] = max_price
        
        # API returns data directly as list
        return self._request('GET', '/api/v1/listings', params=params)
    
    def purchase_listing(
        self,
        listing_id: int,
        stripe_payment_intent_id: str
    ) -> Dict[str, Any]:
        """
        Purchase a W-Matrix listing
        
        Args:
            listing_id: ID of the listing to purchase
            stripe_payment_intent_id: Stripe payment intent ID
            
        Returns:
            Dictionary with purchase_id, download_url, and download_expires_at
            
        Example:
            >>> result = client.w_matrix.purchase_listing(
            ...     listing_id=123,
            ...     stripe_payment_intent_id="pi_1234567890"
            ... )
            >>> print(result['download_url'])
            >>> print(result['download_expires_at'])  # Valid for 7 days
        """
        payload = {
            'listing_id': listing_id,
            'stripe_payment_intent_id': stripe_payment_intent_id
        }
        
        return self._request('POST', '/api/v1/purchase', json=payload)
    
    def get_listing(self, listing_id: int) -> Dict[str, Any]:
        """
        Get details of a specific listing
        
        Note: This method uses browse_listings with filtering as the API
        doesn't have a dedicated get-by-id endpoint yet.
        
        Args:
            listing_id: ID of the listing
            
        Returns:
            Listing details dictionary
            
        Raises:
            NotFoundError: If listing not found
        """
        # Use browse with limit=1000 and filter in Python
        # This is a workaround until a dedicated endpoint is available
        all_listings = self.browse_listings(limit=1000)
        
        for listing in all_listings:
            if listing.get('id') == listing_id:
                return listing
        
        raise NotFoundError(f"Listing with ID {listing_id} not found")
