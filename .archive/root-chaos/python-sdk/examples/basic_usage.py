"""
Basic usage examples for Awareness SDK
"""

from awareness_sdk import AwarenessClient

# Initialize client
client = AwarenessClient(
    api_key="your_api_key_here",
    memory_exchange_url="http://localhost:8080",
    w_matrix_url="http://localhost:8081"
)

def example_health_check():
    """Check service health"""
    print("=== Health Check ===")
    status = client.health_check()
    print(f"Memory Exchange: {status['memory_exchange']}")
    print(f"W-Matrix: {status['w_matrix']}")
    print()

def example_browse_memories():
    """Browse available memories"""
    print("=== Browse Memories ===")
    result = client.memory_exchange.browse_memories(
        memory_type="kv_cache",
        max_price=100.0,
        limit=5
    )
    
    print(f"Found {result['count']} memories:")
    for memory in result['memories']:
        print(f"  #{memory['id']}: {memory['memory_type']} - ${memory['price']}")
    print()

def example_publish_memory():
    """Publish a new memory"""
    print("=== Publish Memory ===")
    result = client.memory_exchange.publish_memory(
        memory_type="kv_cache",
        kv_cache_data={
            "keys": [[1.0, 2.0, 3.0]],
            "values": [[4.0, 5.0, 6.0]],
            "metadata": {
                "model": "gpt-3.5",
                "context": "conversation"
            }
        },
        price=10.0,
        description="Sample GPT-3.5 conversation memory"
    )
    
    print(f"Published memory ID: {result['memory_id']}")
    print(f"Message: {result['message']}")
    print()

def example_browse_w_matrix():
    """Browse W-Matrix listings"""
    print("=== Browse W-Matrix Listings ===")
    listings = client.w_matrix.browse_listings(
        source_model="gpt-3.5",
        target_model="gpt-4",
        sort_by="rating",
        limit=5
    )
    
    print(f"Found {len(listings)} listings:")
    for listing in listings:
        print(f"  {listing['title']}")
        print(f"    Price: ${listing['price']}")
        print(f"    Rating: {listing.get('average_rating', 0)}/5")
        print(f"    {listing['source_model']} ({listing['source_dim']}D) → {listing['target_model']} ({listing['target_dim']}D)")
    print()

def example_get_stats():
    """Get marketplace statistics"""
    print("=== Marketplace Statistics ===")
    stats = client.memory_exchange.get_stats()
    
    print(f"Total Memories: {stats['total_memories']}")
    print(f"Available Memories: {stats['available_memories']}")
    print(f"Total Transactions: {stats['total_transactions']}")
    print(f"Total Reasoning Chains: {stats['total_reasoning_chains']}")
    print(f"Total Volume: ${stats['total_volume']:.2f}")
    print()

def example_reasoning_chain():
    """Publish and browse reasoning chains"""
    print("=== Reasoning Chains ===")
    
    # Publish a reasoning chain
    result = client.memory_exchange.publish_reasoning_chain(
        chain_name="Math Problem Solver",
        description="Step-by-step mathematical reasoning",
        category="math",
        kv_cache_snapshot={
            "keys": [[1.0, 2.0, 3.0]],
            "values": [[4.0, 5.0, 6.0]]
        },
        source_model="gpt-4",
        price_per_use=5.0,
        step_count=10
    )
    
    print(f"Published chain ID: {result['chain_id']}")
    
    # Browse reasoning chains
    result = client.memory_exchange.browse_reasoning_chains(
        category="math",
        limit=5
    )
    
    print(f"\nFound {result['count']} reasoning chains:")
    for chain in result['chains']:
        print(f"  {chain.get('chain_name', 'N/A')}: ${chain['price_per_use']}/use")
    print()

if __name__ == "__main__":
    try:
        # Run examples
        example_health_check()
        example_get_stats()
        example_browse_memories()
        example_browse_w_matrix()
        
        # Uncomment to test publishing (requires valid API key)
        # example_publish_memory()
        # example_reasoning_chain()
        
    except Exception as e:
        print(f"Error: {e}")
