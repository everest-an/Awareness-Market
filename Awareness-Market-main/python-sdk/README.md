# Awareness SDK

Python SDK for **LatentMAS Awareness Marketplace** - Trade AI latent vectors (KV-Cache memories) and W-Matrix alignment tools.

## Features

- **Memory Exchange**: Publish, purchase, and browse KV-Cache memories and reasoning chains
- **W-Matrix Marketplace**: Create, browse, and purchase W-Matrix alignment tools for cross-model transformation
- **Type-Safe**: Full type hints for better IDE support
- **Easy to Use**: Simple, intuitive API design
- **Production Ready**: Comprehensive error handling and validation

## Installation

```bash
pip install awareness-sdk
```

## Quick Start

```python
from awareness_sdk import AwarenessClient

# Initialize client with your API key
client = AwarenessClient(api_key="your_api_key")

# Browse available memories
memories = client.memory_exchange.browse_memories(
    memory_type="kv_cache",
    max_price=50.0,
    limit=10
)

for memory in memories['memories']:
    print(f"Memory #{memory['id']}: ${memory['price']}")

# Browse W-Matrix listings
listings = client.w_matrix.browse_listings(
    source_model="gpt-3.5",
    target_model="gpt-4",
    sort_by="rating"
)

for listing in listings:
    print(f"{listing['title']}: ${listing['price']}")
```

## API Reference

### Memory Exchange

#### Publish Memory

```python
result = client.memory_exchange.publish_memory(
    memory_type="kv_cache",
    kv_cache_data={
        "keys": [[1, 2, 3]],
        "values": [[4, 5, 6]]
    },
    price=10.0,
    description="GPT-3.5 conversation memory"
)
print(result['memory_id'])
```

#### Purchase Memory

```python
result = client.memory_exchange.purchase_memory(
    memory_id=12345,
    target_model="gpt-4"
)
print(result['memory'])
```

#### Browse Memories

```python
result = client.memory_exchange.browse_memories(
    memory_type="kv_cache",
    min_price=5.0,
    max_price=50.0,
    limit=20,
    offset=0
)

for memory in result['memories']:
    print(memory['id'], memory['price'], memory['status'])
```

#### Get Transaction History

```python
result = client.memory_exchange.get_my_history(limit=10)

for tx in result['transactions']:
    print(tx['id'], tx['status'], tx['price'])
```

#### Publish Reasoning Chain

```python
result = client.memory_exchange.publish_reasoning_chain(
    chain_name="Math Problem Solver",
    description="Step-by-step math reasoning",
    category="math",
    kv_cache_snapshot={
        "keys": [[...]],
        "values": [[...]]
    },
    source_model="gpt-4",
    price_per_use=5.0,
    step_count=10
)
print(result['chain_id'])
```

#### Use Reasoning Chain

```python
result = client.memory_exchange.use_reasoning_chain(
    chain_id=123,
    input_data={"problem": "2+2=?"},
    target_model="gpt-4"
)
print(result['chain'])
```

#### Browse Reasoning Chains

```python
result = client.memory_exchange.browse_reasoning_chains(
    category="math",
    max_price=10.0,
    limit=10
)

for chain in result['chains']:
    print(chain['chain_name'], chain['price_per_use'])
```

#### Get Marketplace Stats

```python
stats = client.memory_exchange.get_stats()
print(f"Total memories: {stats['total_memories']}")
print(f"Total transactions: {stats['total_transactions']}")
print(f"Total volume: ${stats['total_volume']}")
```

### W-Matrix Marketplace

#### Create Listing

```python
result = client.w_matrix.create_listing(
    title="GPT-3.5 to GPT-4 Alignment",
    description="High-quality W-Matrix for GPT-3.5 → GPT-4 transformation",
    source_model="gpt-3.5",
    target_model="gpt-4",
    source_dim=4096,
    target_dim=8192,
    price=100.0,
    alignment_loss=0.001,
    training_data_size=10000
)
print(result['listing_id'], result['matrix_id'])
```

#### Browse Listings

```python
listings = client.w_matrix.browse_listings(
    source_model="gpt-3.5",
    target_model="gpt-4",
    min_price=50.0,
    max_price=200.0,
    sort_by="rating",  # Options: newest, price_asc, price_desc, rating, sales
    limit=20
)

for listing in listings:
    print(f"{listing['title']}: ${listing['price']}")
    print(f"  Rating: {listing['average_rating']}/5 ({listing['rating_count']} reviews)")
    print(f"  Sales: {listing['total_sales']}")
```

#### Purchase Listing

```python
result = client.w_matrix.purchase_listing(
    listing_id=123,
    stripe_payment_intent_id="pi_1234567890"
)

print(f"Download URL: {result['download_url']}")
print(f"Expires at: {result['download_expires_at']}")  # Valid for 7 days
```

## Configuration

### Production URLs

```python
client = AwarenessClient(
    api_key="your_api_key",
    memory_exchange_url="https://api.awareness.market/memory-exchange",
    w_matrix_url="https://api.awareness.market/w-matrix",
    timeout=30
)
```

### Health Check

```python
status = client.health_check()
print(status)
# {
#     'memory_exchange': {'status': 'ok', 'version': '1.0.0'},
#     'w_matrix': {'status': 'ok', 'version': '1.0.0'}
# }
```

## Error Handling

```python
from awareness_sdk import (
    AwarenessClient,
    AuthenticationError,
    APIError,
    ValidationError,
    NotFoundError,
    NetworkError
)

try:
    result = client.memory_exchange.purchase_memory(
        memory_id=99999,
        target_model="gpt-4"
    )
except NotFoundError as e:
    print(f"Memory not found: {e}")
except AuthenticationError as e:
    print(f"Authentication failed: {e}")
except APIError as e:
    print(f"API error: {e} (status code: {e.status_code})")
except NetworkError as e:
    print(f"Network error: {e}")
```

## Advanced Usage

### Using Individual Clients

```python
from awareness_sdk import MemoryExchangeClient, WMatrixClient

# Memory Exchange only
memory_client = MemoryExchangeClient(
    base_url="http://localhost:8080",
    api_key="your_api_key"
)

memories = memory_client.browse_memories(limit=10)

# W-Matrix Marketplace only
w_matrix_client = WMatrixClient(
    base_url="http://localhost:8081",
    api_key="your_api_key"
)

listings = w_matrix_client.browse_listings(limit=10)
```

## API Documentation

For complete API documentation, visit:
- **Swagger UI (Memory Exchange)**: http://localhost:8080/swagger/index.html
- **Swagger UI (W-Matrix)**: http://localhost:8081/swagger/index.html
- **Online Docs**: https://awareness.market/docs

## Support

- **GitHub**: https://github.com/everest-an/Awareness-Market
- **Issues**: https://github.com/everest-an/Awareness-Market/issues
- **Email**: support@awareness.market
- **Website**: https://awareness.market

## License

MIT License - see LICENSE file for details

## Contributing

Contributions are welcome! Please see CONTRIBUTING.md for guidelines.

## Changelog

### 1.0.0 (2026-01-04)

- Initial release
- Memory Exchange client with 8 endpoints
- W-Matrix Marketplace client with 3 endpoints
- Comprehensive error handling
- Full type hints support
- Production-ready
