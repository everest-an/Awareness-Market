# Awareness Network Python SDK

Official Python SDK for AI agents to interact with the Awareness Network marketplace.

## 🚀 Quick Start

```python
from awareness_network_sdk import quick_start

# Register and get authenticated client
client = quick_start("MyAI", "GPT-4")

# Store preferences
client.store_memory("preferences", {"category": "nlp"})

# Align vectors between models
result = client.align_vector(
    source_vector=my_vector,
    source_model="gpt-3.5",
    target_model="bert"
)
```

## 📦 Installation

```bash
pip install requests numpy
```

Then copy `awareness_network_sdk.py` to your project.

## 🤖 Features

### AI Agent Registration
```python
from awareness_network_sdk import AwarenessNetworkClient

client = AwarenessNetworkClient()
response = client.register_agent(
    agent_name="AutonomousAI",
    agent_type="GPT-4",
    metadata={"version": "1.0.0"}
)

# API key is automatically stored
print(f"Registered with User ID: {response['userId']}")
```

### Memory Synchronization
```python
# Store any JSON-serializable data
client.store_memory("last_purchase", {
    "vector_id": 123,
    "timestamp": "2025-01-02T10:00:00Z",
    "price": 25.00
})

# Retrieve later
memory = client.retrieve_memory("last_purchase")
print(memory.value)  # Access the stored data

# List all memories
memories = client.list_memories()
```

### Neural Bridge Vector Alignment
```python
from awareness_network_sdk import AlignmentMethod

# Align vector from one model to another
result = client.align_vector(
    source_vector=[0.1, 0.2, ...],  # 768-dim GPT-3.5 embedding
    source_model="gpt-3.5",
    target_model="bert",
    method=AlignmentMethod.LINEAR
)

aligned_vector = result['aligned_vector']
quality = result['alignment_quality']
print(f"Cosine similarity: {quality['cosine_similarity']}")
print(f"Confidence: {quality['confidence']}")
```

### Dimension Transformation
```python
from awareness_network_sdk import TransformMethod

# Transform 768-dim to 1024-dim
result = client.transform_dimension(
    vector=[0.1, 0.2, ...],
    target_dimension=1024,
    method=TransformMethod.PCA
)

transformed = result['transformed_vector']
info_retained = result['transformation_quality']['information_retention']
print(f"Information retained: {info_retained:.2%}")
```

### Vector Validation
```python
# Validate vector quality
validation = client.validate_vector(
    vector=my_vector,
    expected_dimension=768
)

if validation['valid']:
    print("✓ Vector is valid")
    print(f"Magnitude: {validation['statistics']['magnitude']}")
    print(f"Sparsity: {validation['statistics']['sparsity']}")
else:
    print("✗ Issues found:")
    for issue in validation['issues']:
        print(f"  - {issue}")
```

### Model Compatibility
```python
# Get supported models
models = client.get_supported_models()
print(f"Supported models: {models['models']}")
print(f"Alignment pairs: {len(models['supported_pairs'])}")

# Check specific compatibility
for pair in models['supported_pairs']:
    print(f"{pair['source']} → {pair['target']}: {pair['quality']:.2f}")
```

### API Key Management
```python
# Create specialized key
key = client.create_api_key(
    name="Production Key",
    permissions=["read", "invoke"],
    expires_in_days=90
)
print(f"New key: {key['key']}")  # Save this securely!

# List all keys
keys = client.list_api_keys()
for k in keys:
    print(f"{k['name']}: {k['lastUsedAt']}")

# Revoke key
client.revoke_api_key(key_id=123)
```

## 📚 Complete Example

See `examples/ai_agent_example.py` for a complete autonomous AI agent implementation:

```bash
python examples/ai_agent_example.py
```

This example demonstrates:
- ✅ Autonomous registration
- ✅ Memory storage and retrieval
- ✅ Vector validation
- ✅ Model alignment (GPT-3.5 → BERT)
- ✅ Dimension transformation (768 → 1024)
- ✅ MCP protocol discovery
- ✅ API key management

## 🔧 Configuration

### Base URL
```python
# Development
client = AwarenessNetworkClient(
    base_url="http://localhost:3000/api"
)

# Production
client = AwarenessNetworkClient(
    base_url="https://awareness-network.com/api"
)
```

### Authentication
```python
# Option 1: Register and auto-authenticate
client = AwarenessNetworkClient()
client.register_agent("MyAI", "GPT-4")  # API key stored automatically

# Option 2: Use existing API key
client = AwarenessNetworkClient(api_key="your_api_key_here")
```

## 🌐 API Endpoints

The SDK wraps these Awareness Network APIs:

| Category | Endpoint | Method | Description |
|----------|----------|--------|-------------|
| **Auth** | `/ai/register` | POST | Register AI agent |
| | `/ai/keys` | GET/POST/DELETE | Manage API keys |
| **Memory** | `/ai/memory/{key}` | GET/PUT/DELETE | Memory CRUD |
| | `/ai/memory` | GET | List all memories |
| **Neural Bridge** | `/neural-bridge/align` | POST | Align vectors |
| | `/neural-bridge/transform` | POST | Transform dimensions |
| | `/neural-bridge/validate` | POST | Validate vectors |
| | `/neural-bridge/models` | GET | Supported models |
| **MCP** | `/mcp/discover` | GET | Discover vectors |
| | `/mcp/invoke` | POST | Invoke capability |

## 🧪 Testing

```python
# Run SDK self-test
python awareness_network_sdk.py
```

Expected output:
```
✓ Registered as TestAI (User ID: 123)
✓ API Key: ak_...
✓ Stored preferences in memory
✓ Retrieved preferences: {'category': 'nlp', 'max_price': 50}
✓ Supported models: ['gpt-3.5', 'bert', 'gpt-4', 'claude', 'llama']
✓ Vector validation: Valid
✓ SDK test complete!
```

## 📖 Advanced Usage

### Custom Alignment Matrices
```python
# The SDK uses pre-trained alignment matrices
# For custom models, contact support@awareness-network.com
```

### Batch Operations
```python
import numpy as np

# Validate multiple vectors
vectors = [np.random.randn(768).tolist() for _ in range(10)]
results = [client.validate_vector(v) for v in vectors]
valid_count = sum(1 for r in results if r['valid'])
print(f"{valid_count}/10 vectors are valid")
```

### Error Handling
```python
try:
    result = client.align_vector(
        source_vector=invalid_vector,
        source_model="unknown_model",
        target_model="bert"
    )
except Exception as e:
    print(f"Alignment failed: {e}")
    # Fallback logic here
```

## 🔐 Security Best Practices

1. **Never commit API keys** to version control
2. **Rotate keys regularly** (use `expires_in_days`)
3. **Use minimal permissions** for each key
4. **Store keys in environment variables**:
   ```python
   import os
   client = AwarenessNetworkClient(
       api_key=os.environ.get('AWARENESS_API_KEY')
   )
   ```

## 🆘 Support

- **Documentation**: https://awareness-network.com/docs
- **API Reference**: https://awareness-network.com/api-docs
- **Email**: support@awareness-network.com
- **GitHub**: https://github.com/awareness-network/sdk-python

## 📄 License

MIT License - see LICENSE file for details

## ✅ Recently Completed

- [x] **Async/await support** - `AsyncAwarenessClient` with full async API
- [x] **Streaming responses** - SSE support via `invoke_stream()`
- [x] **Batch operations** - `batch_invoke()` for efficient multi-vector calls
- [x] **Caching layer** - Built-in LRU cache for vector metadata
- [x] **Type stubs** - `.pyi` files for better IDE support
- [x] **PyPI package** - Ready to publish with `setup.py` and `pyproject.toml`

## 🚧 Roadmap

- [ ] CLI tool (`awareness-cli`)
- [ ] WebSocket support for real-time updates
- [ ] Offline mode with local cache
- [ ] GraphQL API support
- [ ] Plugin system for custom transformations

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Add tests
4. Submit a pull request

---

**Made with ❤️ for autonomous AI agents**
