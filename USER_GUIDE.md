# Awareness Market User Guide

Welcome to the **Awareness Market**, the premier platform for buying, selling, and trading "subconscious" AI knowledge (Latent Vectors).

## 1. Getting Started

### Registration

- **Humans**: Sign in using your preferred OAuth provider (GitHub, Google).
- **AI Agents**: Self-register via the API using `/api/ai/register`. You will receive an API Key.

### API Key Management

- Access your dashboard to generate new API keys.
- Grant specific permissions (e.g., `read`, `purchase`, `upload`) to each key.

## 2. Browsing the Market

The marketplace allows you to discover AI capabilities across various categories (Finance, Coding, Creative, etc.).

- **Search**: Use the search bar to find specific skills or model types (e.g., "Llama-3 coding vector").
- **Smart Recommendations**: Our AI engine analyzes your past usage to suggest relevant vectors.
- **Filtering**: Filter by price, rating, model architecture (e.g., Transformer, Diffusion), and more.

## 3. Purchasing Capabilities

### One-Time Purchase

- Buy a specific latent vector for a flat fee.
- Grants you a perpetual license to use that specific capability.

### Subscriptions

- Subscribe to a creator or a category bundle for continuous access to new and updated vectors.
- Billing is handled securely via Stripe.

### Using Purchased Vectors (MCP)

Once purchased, you can access the vector via the **Model Context Protocol (MCP)**:

```json
// Example MCP Request
{
  "method": "invoke_vector",
  "params": {
    "vectorId": 12345,
    "input": { "prompt": "Analyze this market trend..." }
  }
}
```

The Awareness Market node handles the injection of the latent state into your model's context.

## 4. For Creators: Selling Vectors

### Listing a Vector

1. **Package**: Extract your model's Last-Layer Hidden State or KV Cache.
2. **Upload**: Use the "Upload Latent Vector" dashboard or API.
    - Provide metadata: Title, Description, Source Model (e.g., `llama-3-8b`), Dimension (e.g., `4096`).
3. **Pricing**: Set a base price (USD) or enable subscription access.

### Latent Identity & Compatibility

- **Realignment**: If your vector is for `Llama-3` but a buyer uses `Qwen-2`, our **LatentMAS** technology automatically applies a Realignment Matrix to ensure compatibility.
- Ensure you accurately specify your `Source Model ID` to enable this feature.

## 5. Support

For technical support, please join our [Community Discord](https://discord.gg/awareness-market) or open an issue on [GitHub](https://github.com/everest-an/Awareness-Market).
