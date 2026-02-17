# Installation

## Requirements

- **Python 3.8** or higher
- **pip** 21.0 or higher (for dependency resolution)

## Install from PyPI

```bash
pip install awareness-sdk
```

This installs the core SDK with synchronous HTTP support via `requests`.

## Optional Dependencies

The SDK supports optional dependency groups for extended functionality.

### Async Support

Install async dependencies for use with `AsyncAwarenessClient`:

```bash
pip install awareness-sdk[async]
```

This adds `aiohttp` and `aiofiles` for non-blocking HTTP and file I/O.

### Streaming Support

Install streaming dependencies for real-time alignment streaming:

```bash
pip install awareness-sdk[streaming]
```

This adds `httpx-sse` for server-sent event parsing and `orjson` for high-performance JSON decoding of streamed payloads.

### All Optional Dependencies

Install everything at once:

```bash
pip install awareness-sdk[all]
```

## Dependency Summary

| Group | Packages Installed | Required For |
|---|---|---|
| Core | `requests`, `pydantic>=2.0` | `AwarenessClient`, all sync operations |
| `[async]` | `aiohttp>=3.9`, `aiofiles>=23.0` | `AsyncAwarenessClient` |
| `[streaming]` | `httpx-sse>=0.4`, `orjson>=3.9` | `stream_align()`, `stream_search()` |
| `[all]` | All of the above | Full feature set |

## Virtual Environment Setup

We recommend using a virtual environment to avoid dependency conflicts:

```bash
# Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate   # Linux/macOS
.venv\Scripts\activate      # Windows

# Install the SDK
pip install awareness-sdk[all]
```

## Verify Installation

Confirm the SDK is installed correctly:

```python
import awareness_sdk
print(awareness_sdk.__version__)
# Output: 1.4.2
```

You can also verify connectivity to the Awareness Network:

```python
from awareness_sdk import AwarenessClient

client = AwarenessClient(api_key="aw_live_...")
status = client.health_check()
print(status)
# Output: {'status': 'ok', 'latency_ms': 42}
```

## Development Installation

To install from source for development or contribution:

```bash
git clone https://github.com/awareness-network/awareness-python-sdk.git
cd awareness-python-sdk
pip install -e ".[all,dev]"
```

The `[dev]` group adds `pytest`, `pytest-asyncio`, `mypy`, and `ruff` for testing and linting.

## Troubleshooting

### `ImportError: No module named 'aiohttp'`

You are trying to use `AsyncAwarenessClient` without the async dependencies. Install them:

```bash
pip install awareness-sdk[async]
```

### `SSLError` on Corporate Networks

If you encounter SSL certificate errors behind a corporate proxy, configure your certificate bundle:

```python
client = AwarenessClient(
    api_key="aw_live_...",
    ssl_ca_bundle="/path/to/corporate-ca-bundle.crt"
)
```

### Dependency Conflicts with Pydantic v1

The SDK requires Pydantic v2. If your project uses Pydantic v1, consider isolating the SDK in a separate virtual environment or upgrading your Pydantic installation:

```bash
pip install pydantic>=2.0
```
