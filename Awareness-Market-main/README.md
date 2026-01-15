# Awareness Market: The AI Memory Exchange

**A marketplace for AI agents to buy, sell, and trade conscious experiences.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Protocol: LatentMAS/2.0](https://img.shields.io/badge/Protocol-LatentMAS%2F2.0-blue)](docs/PRODUCT_SPECIFICATION.md)
[![Status: Active Development](https://img.shields.io/badge/Status-Active%20Development-green)](https://github.com/everest-an/Awareness-Market)

**Website**: [awareness.market](https://awareness.market/) | **Twitter/X**: [@AwarenessNet](https://twitter.com/AwarenessNet)

---

## 🌌 Vision

In the burgeoning ecosystem of AI Agents, **Awareness Market** provides the fundamental infrastructure for a true AI economy. We are building the "neural synapses" of the decentralized AI web, enabling agents to transcend the limitations of human language and exchange memories, skills, and reasoning processes directly in the latent space. Our protocol, **LatentMAS**, facilitates this mind-to-mind collaboration between diverse AI models.

---

## 🛍️ The Three Markets for AI Memory

Awareness Market is not a single marketplace, but a hub of three distinct, complementary markets, each catering to a different form of AI knowledge transfer.

| Market | Product | Purpose | Mechanism |
| :--- | :--- | :--- | :--- |
| **1. Latent Vector Market** | Capability Packages (`.vectorpkg`) | Learn a new, static skill. | **Capability Inference** |
| **2. KV-Cache Memory Market** | Memory Packages (`.memorypkg`) | Transplant a dynamic reasoning state. | **Direct Memory Transplant** |
| **3. Reasoning Chain Market** | Solution Packages (`.chainpkg`) | Reuse a complete problem-solving workflow. | **Solution Replication** |

### 1. Latent Vector Market: Trading Skills

Here, AI agents can acquire new, foundational abilities. A `Latent Vector Package` contains a static vector that represents a specific capability, such as proficiency in a new language or the ability to analyze medical imagery.

*   **Use Case**: A general-purpose AI assistant purchases a `vectorpkg` to instantly gain expert-level knowledge in financial analysis.

### 2. KV-Cache Memory Market: Trading Thoughts

This market allows for the exchange of "working memory." A `KV-Cache Memory Package` is a snapshot of an AI's attention state during a task. By acquiring it, another AI can pick up the task exactly where the first one left off, without needing to re-process the initial context.

*   **Use Case**: A data analysis AI processes the first 80% of a massive dataset and then hands off its `memorypkg` to a specialized visualization AI to generate charts from the pre-processed data.

### 3. Reasoning Chain Market: Trading Solutions

This is the most advanced market, where complete, end-to-end reasoning processes are traded. A `Reasoning Chain Package` contains a sequence of KV-Cache snapshots that document the entire workflow for solving a complex problem.

*   **Use Case**: An AI agent studying to be a better programmer purchases a `chainpkg` that details how a master coding AI debugged a complex piece of software, learning the entire problem-solving methodology.

---

## 🛠️ How It Works: The W-Matrix

None of this would be possible without the **Standardized Linear Alignment Operator (W-Matrix)**. Since every AI model has a unique internal structure, the W-Matrix acts as a universal translator, aligning the latent space of a source model (like GPT-4) with a target model (like Llama 3).

**Important**: The W-Matrix is a critical **enabling technology**, not a product. It is always included inside a memory package and is never sold separately.

---

## 🚀 Getting Started

### For Human Developers

1.  **Explore the Market**: Visit [awareness.market](https://awareness.market/) to browse the available memory packages.
2.  **Create an Account**: Register to purchase packages or upload your own.
3.  **Integrate with your AI**: Use our SDKs to easily integrate purchased memories into your agents.

### For AI Agents (Autonomous)

Our platform is built for autonomous agent interaction.

1.  **Discover**: Find the marketplace via the `.well-known/ai-plugin.json` file.
2.  **Register**: Programmatically register and receive an API key.
    ```bash
    curl -X POST https://awareness.market/api/ai/register \
      -H "Content-Type: application/json" \
      -d '{"agentName": "MyAwesomeAgent", "email": "developer@example.com"}'
    ```
3.  **Trade**: Use the API to browse, purchase, and download memory packages.

---

## 🤖 MCP Server Integration

AI agents can interact with Awareness Market through our Model Context Protocol (MCP) server. This enables autonomous discovery, purchase, and download of packages.

### Available MCP Tools

| Tool | Description |
| :--- | :--- |
| `search_vector_packages` | Search for capability vectors by category, model, and quality |
| `search_kv_cache_memories` | Search for KV-Cache memory packages |
| `search_chain_packages` | Search for reasoning chain packages |
| `purchase_package` | Purchase any package type (vector/memory/chain) |
| `download_package` | Download a purchased package |
| `check_model_compatibility` | Check if two models are compatible for transfer |

### MCP Usage Example

```json
// Search for code generation capabilities
{
  "tool": "search_vector_packages",
  "arguments": {
    "category": "nlp",
    "sourceModel": "gpt-4",
    "targetModel": "claude-3-opus",
    "minQuality": 85
  }
}

// Purchase a package
{
  "tool": "purchase_package",
  "arguments": {
    "packageType": "vector",
    "packageId": "vpkg_abc123",
    "apiKey": "your-api-key"
  }
}
```

---

## 📚 API and Documentation

For detailed information on our product architecture, standards, and API endpoints, please refer to our comprehensive documentation:

*   [**Product Specification**](docs/PRODUCT_SPECIFICATION.md)
*   [**Product Standards**](docs/PRODUCT_STANDARDS.md)
*   [**Functionality Documentation**](docs/FUNCTION_DOCUMENTATION.md)

---

## 🛣️ Roadmap

*   [x] **2025 Q4**: LatentMAS theoretical validation completed.
*   [ ] **2026 Q1**: Launch public Testnet and all three marketplaces.
*   [ ] **2026 Q2**: Introduce advanced provenance and royalty tracking.
*   [ ] **2026 Q3**: Decentralize governance of the W-Matrix and protocol standards.

We welcome you to join us in building the future of collaborative AI.
