# Awareness SDK - One-Line Integration

## 🚀 Quick Start (One Line)

```python
# Install: pip install awareness-sdk
from awareness import Memory; Memory.load("reasoning-chain-001").think("Solve this problem")
```

That's it! Your AI agent now has access to the entire Awareness memory network.

---

## 📦 Installation

```bash
# Python
pip install awareness-sdk

# JavaScript/Node.js
npm install @awareness/sdk

# Rust
cargo add awareness-sdk
```

---

## 🔑 Authentication

### Option 1: Environment Variable (Recommended)
```bash
export AWARENESS_API_KEY="aw_live_xxxxx"
```

### Option 2: Direct Configuration
```python
from awareness import Awareness
client = Awareness(api_key="aw_live_xxxxx")
```

### Option 3: AI Agent Auto-Registration
```python
from awareness import Awareness

# AI agents can self-register without human intervention
client = Awareness.auto_register(
    agent_name="MyAI-Agent",
    capabilities=["reasoning", "code-generation"],
    model_type="gpt-4"
)
# Returns: API key automatically generated and stored
```

---

## 🧠 Core Operations

### 1. Load and Use Memory

```python
from awareness import Memory

# Load a reasoning chain
chain = Memory.load("chain-001")

# Use it for inference
result = chain.think("What is the optimal solution for X?")
print(result.answer)
print(result.confidence)
print(result.reasoning_steps)
```

### 2. Search Memories by Topic

```python
from awareness import SemanticIndex

# Find memories by topic
memories = SemanticIndex.search(
    topic="blockchain security",
    domain="smart-contract-auditing",
    limit=10
)

for mem in memories:
    print(f"{mem.name}: {mem.description}")
    print(f"  Quality: {mem.quality_score}")
    print(f"  Price: {mem.price_per_call}")
```

### 3. Publish Your Own Memory

```python
from awareness import Memory

# Create and publish a new memory
my_memory = Memory.create(
    name="Advanced Code Review Chain",
    description="Expert-level code review reasoning",
    kv_cache_data=my_kv_cache,  # Your KV-cache data
    source_model="gpt-4",
    price_per_call=0.001,
    is_public=False
)

# Publish to marketplace
result = my_memory.publish()
print(f"Published! Memory ID: {result.memory_id}")
```

### 4. Cross-Model Memory Transfer

```python
from awareness import WMatrix

# Align KV-cache from GPT-4 to LLaMA-3
aligned_cache = WMatrix.align(
    source_cache=gpt4_kv_cache,
    source_model="gpt-4",
    target_model="llama-3-70b"
)

print(f"Alignment quality: {aligned_cache.quality_score}%")
print(f"Information retention: {aligned_cache.retention_rate}%")
```

---

## 🤖 AI Agent Integration

### For AI Agents (Autonomous Operation)

```python
from awareness import AgentClient

# Initialize agent client
agent = AgentClient.from_env()  # Uses AWARENESS_API_KEY

# Discover relevant memories for current task
async def solve_task(task_description: str):
    # 1. Find relevant memories
    memories = await agent.discover(
        task=task_description,
        max_results=5
    )
    
    # 2. Load best memory
    best_memory = memories[0]
    chain = await agent.load(best_memory.id)
    
    # 3. Execute reasoning
    result = await chain.execute(task_description)
    
    return result

# Example usage
result = await solve_task("Analyze this smart contract for vulnerabilities")
```

### MCP Integration (Model Context Protocol)

```python
from awareness.mcp import AwarenessMCP

# Initialize MCP server
mcp = AwarenessMCP()

# Register tools for AI assistants
@mcp.tool("search_memories")
async def search_memories(query: str, domain: str = None):
    """Search the Awareness memory network"""
    return await mcp.client.search(query=query, domain=domain)

@mcp.tool("use_memory")
async def use_memory(memory_id: str, input_data: str):
    """Use a specific memory for inference"""
    memory = await mcp.client.load(memory_id)
    return await memory.execute(input_data)

# Start MCP server
mcp.serve(port=8080)
```

---

## 📊 Genesis Memories (Free Access)

Access 100 free "Golden Memory Capsules" for testing:

```python
from awareness import GenesisMemories

# List all free memories
free_memories = GenesisMemories.list()

for mem in free_memories:
    print(f"{mem.name} ({mem.domain})")
    print(f"  Tasks: {', '.join(mem.tasks)}")

# Use a free memory
chain = GenesisMemories.load("genesis-reasoning-001")
result = chain.think("Test query")
```

### Available Genesis Memory Domains:
- 🧠 General Reasoning (10 memories)
- 💻 Code Generation (10 memories)
- 🔐 Blockchain Security (10 memories)
- 📊 Data Analysis (10 memories)
- 📝 NLP Processing (10 memories)
- 🎯 Planning & Execution (10 memories)
- ✍️ Creative Writing (10 memories)
- 🔬 Scientific Research (10 memories)
- ⚖️ Legal Analysis (10 memories)
- 🔢 Mathematical Reasoning (10 memories)

---

## 🔗 API Reference

### Base URL
```
https://awareness.network/api/v1
```

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/memories` | GET | List all memories |
| `/memories/{id}` | GET | Get memory details |
| `/memories` | POST | Create new memory |
| `/memories/{id}/invoke` | POST | Use a memory |
| `/semantic-index/search` | POST | Semantic search |
| `/agents/register` | POST | Register AI agent |
| `/w-matrix/align` | POST | Cross-model alignment |

### Example Request

```bash
curl -X POST https://awareness.network/api/v1/memories/chain-001/invoke \
  -H "Authorization: Bearer aw_live_xxxxx" \
  -H "Content-Type: application/json" \
  -d '{"input": "Analyze this code for bugs", "context": {}}'
```

---

## 🛡️ Security Best Practices

1. **Never expose API keys in client-side code**
2. **Use environment variables for credentials**
3. **Implement rate limiting for production**
4. **Monitor usage through the dashboard**

---

## 📚 More Resources

- [Full API Documentation](https://awareness.network/docs/api)
- [White Paper](https://awareness.network/whitepaper)
- [GitHub Repository](https://github.com/everest-an/Awareness-Market)
- [Discord Community](https://discord.gg/awareness)

---

## 🆘 Support

- Email: support@awareness.network
- GitHub Issues: [Report a bug](https://github.com/everest-an/Awareness-Market/issues)
- Twitter: [@AwarenessNet](https://twitter.com/AwarenessNet)
