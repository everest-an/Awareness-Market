# Installation

## Requirements

- **Node.js 18** or higher (for native `fetch` support)
- **npm**, **yarn**, or **pnpm**

For browser usage, any modern browser with `fetch` and `ReadableStream` support (Chrome 89+, Firefox 102+, Safari 15.4+, Edge 89+).

## Install from npm

Choose your preferred package manager:

{% tabs %}
{% tab title="npm" %}
```bash
npm install @awareness/sdk
```
{% endtab %}

{% tab title="yarn" %}
```bash
yarn add @awareness/sdk
```
{% endtab %}

{% tab title="pnpm" %}
```bash
pnpm add @awareness/sdk
```
{% endtab %}
{% endtabs %}

## TypeScript Support

TypeScript types are included in the package. No separate `@types/` installation is required.

The SDK requires **TypeScript 5.0** or higher if you are using TypeScript. Add the following to your `tsconfig.json` if it is not already present:

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "target": "ES2022"
  }
}
```

{% hint style="info" %}
The SDK ships both ESM and CommonJS builds. The `"moduleResolution": "bundler"` setting ensures TypeScript resolves the correct entry point. If you are using `"moduleResolution": "node16"` or `"nodenext"`, the SDK's `exports` map in `package.json` handles resolution automatically.
{% endhint %}

## Module Formats

The SDK ships as:

| Format | Entry Point | Use Case |
|---|---|---|
| ESM | `@awareness/sdk` (default) | Modern bundlers, Node.js with `"type": "module"` |
| CommonJS | `@awareness/sdk` (conditional export) | Legacy Node.js, `require()` usage |

### ESM (recommended)

```typescript
import { AwarenessClient } from '@awareness/sdk';
```

### CommonJS

```javascript
const { AwarenessClient } = require('@awareness/sdk');
```

## Verify Installation

```typescript
import { AwarenessClient } from '@awareness/sdk';

const client = new AwarenessClient({
  apiKey: 'aw_live_...',
});

const status = await client.healthCheck();
console.log(status);
// Output: { status: 'ok', latencyMs: 38 }
```

## Environment Variables

The client reads the following environment variables as fallbacks:

| Variable | Description |
|---|---|
| `AWARENESS_API_KEY` | API key (used when `apiKey` is not passed to the constructor) |
| `AWARENESS_BASE_URL` | API base URL override |

```bash
# .env
AWARENESS_API_KEY=aw_live_your_key_here
```

```typescript
import { AwarenessClient } from '@awareness/sdk';

// Reads AWARENESS_API_KEY from environment automatically
const client = new AwarenessClient();
```

## CDN Usage (Browser)

For quick prototyping, you can load the SDK from a CDN:

```html
<script type="module">
  import { AwarenessClient } from 'https://cdn.jsdelivr.net/npm/@awareness/sdk/dist/index.mjs';

  const client = new AwarenessClient({
    apiKey: 'aw_live_...',
  });

  const results = await client.vectors.search({ query: 'reasoning' });
  console.log(results);
</script>
```

{% hint style="warning" %}
Avoid exposing your API key in client-side code in production. Use a backend proxy or session-based authentication for browser applications.
{% endhint %}

## Bundler Configuration

### Vite

No special configuration required. The SDK works out of the box with Vite.

### webpack

If you encounter issues with the `node:` protocol imports in webpack 4, add the following to your webpack configuration:

```javascript
// webpack.config.js
module.exports = {
  resolve: {
    fallback: {
      "node:crypto": false,
      "node:buffer": require.resolve("buffer/"),
    },
  },
};
```

webpack 5 handles this automatically.

## Troubleshooting

### `ERR_REQUIRE_ESM`

You are importing the ESM build with `require()`. Either switch to ESM imports or ensure your `package.json` does not have `"type": "module"` if you want to use CommonJS.

### `fetch is not defined`

You are running on Node.js < 18. Upgrade to Node.js 18 or install a polyfill:

```bash
npm install undici
```

```typescript
import { fetch } from 'undici';
import { AwarenessClient } from '@awareness/sdk';

const client = new AwarenessClient({
  apiKey: 'aw_live_...',
  fetch, // Pass custom fetch implementation
});
```
