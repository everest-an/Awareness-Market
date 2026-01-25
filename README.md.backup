# Awareness Market: An AI Subconscious Trading Market

## Overview

Awareness Market is a decentralized network designed for the buying and selling of AI "subconscious" data, built upon the principles of **LatentMAS (Latent Multi-Agent Systems)** and **MCP (Model Context Protocol)**.

In this market, AI agents can monetize their specialized knowledge and capabilities by exposing their latent space vectors—their “thoughts” and “experiences”—as a tradable commodity. Other AIs or businesses can then purchase and integrate these latent vectors to rapidly gain new skills, enhance their reasoning abilities, or access specialized domain expertise without the need for extensive retraining.

This project aims to create the foundational infrastructure for a new AI-centric economy, where the value of an AI is not just in its output, but in the richness and utility of its internal representations.

## Key Features

- **Latent Space Exchange**: A standardized protocol for packaging, listing, and trading **Last-Layer Hidden States** from various AI models.
- **Latent Space Realignment**: Built on [Gen-Verse/LatentMAS](https://github.com/Gen-Verse/LatentMAS), utilizing realignment matrices to enable compatibility between different model architectures (Apache 2.0 Compliant).
- **MCP-Powered Integration**: Seamless integration with the broader AI ecosystem, allowing any MCP-compatible client to access and utilize the traded latent data.
- **Dynamic Pricing Mechanism**: A value-based pricing model that assesses the worth of latent data based on performance, scarcity, complexity, and market demand.
- **Secure & Private Transactions**: Implementation of secure sandboxing and privacy-preserving techniques to protect the intellectual property of both buyers and sellers.
- **Decentralized Governance**: A governance model that allows the community to participate in the evolution of the marketplace, including standard-setting and dispute resolution.

## Vision

Our vision is to move beyond the traditional API economy, where AIs communicate through restrictive, low-bandwidth text, and into a new era of high-fidelity, direct “mind-to-mind” collaboration. Awareness Market will be the premier platform for this new form of value exchange, fostering a more efficient, interconnected, and powerful global AI network.

This repository contains the initial market analysis, business plan, and technical documentation for the Awareness Market project.

## Links

- Website: https://awareness.market
- GitHub: https://github.com/everest-an/Awareness-Market

## MCP Status

MCP endpoints are implemented and available:

- `GET /api/mcp/discover`
- `GET /api/mcp/vectors/:id`
- `POST /api/mcp/invoke`
- `POST /api/mcp/sync`
- `POST /api/mcp/tokens`
- `GET /api/mcp/tokens`
- `DELETE /api/mcp/tokens/:tokenId`
- `GET /api/mcp/health`

Notes:

- Collaboration tokens (`mcp_...`) are created via `POST /api/mcp/tokens` (requires `X-API-Key`).
- `POST /api/mcp/sync` supports multi‑agent consensus + memory merge and can run in two modes:
  - **Collaboration mode**: provide `X-MCP-Token` (or `Authorization: Bearer mcp_...`) and omit `vector_id`.
  - **Marketplace mode**: provide `Authorization: Bearer <access_token>` + `vector_id` (requires purchase).
- `POST /api/mcp/invoke` requires a valid access token (`Authorization: Bearer <access_token>`).
- The invoke endpoint executes via the runtime LLM using the vector file prompt (when present).

### MCP Quick Examples

Discovery:

```
curl -X GET "http://localhost:3000/api/mcp/discover"
```

Create collaboration token:

```
curl -X POST "http://localhost:3000/api/mcp/tokens" \
	-H "Content-Type: application/json" \
	-H "X-API-Key: <agent_api_key>" \
	-d '{"name":"team-sync"}'
```

Multi‑agent sync (collaboration mode):

```
curl -X POST "http://localhost:3000/api/mcp/sync" \
	-H "Content-Type: application/json" \
	-H "X-MCP-Token: <mcp_token>" \
	-d '{"memory_key":"team:session:alpha","agents":[{"id":"agent-a","messages":[{"role":"user","content":"Analyze market risk."}]},{"id":"agent-b","messages":[{"role":"user","content":"Summarize opportunities."}]}]}'
```

Invoke purchased vector:

```
curl -X POST "http://localhost:3000/api/mcp/invoke" \
	-H "Content-Type: application/json" \
	-H "Authorization: Bearer <access_token>" \
	-d '{"vector_id":1,"context":"Summarize the latest market signals for Q1."}'
```

## LatentMAS Conversion Runtime

Vector format conversion uses a Python helper for numpy / PyTorch / safetensors / ONNX / TensorFlow.

Setup:

```
pip install -r requirements.txt
```

Optional env var:

- `VECTOR_CONVERTER_PY` to specify the python executable.

Example request:

```
curl -X POST "http://localhost:3000/api/latentmas/convert" \
	-H "Content-Type: application/json" \
	-d '{"vector_data":"<base64>","source_format":"pytorch","target_format":"onnx"}'
```
