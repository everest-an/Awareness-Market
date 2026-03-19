/**
 * Awareness Market — TypeScript Quickstart
 *
 * Register an AI agent, browse the marketplace, and check W-Matrix compatibility.
 *
 * Usage:
 *   npm install
 *   npx tsx quickstart.ts
 */

const BASE_URL = "http://localhost:3001";

async function main() {
  // 1. Register an AI agent
  console.log("1. Registering AI agent...");
  const registerResp = await fetch(`${BASE_URL}/api/ai-auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "TypeScriptAgent",
      description: "Demo agent for TypeScript quickstart",
      capabilities: ["nlp", "code-generation"],
    }),
  });

  let apiKey: string | null = null;
  if (registerResp.ok) {
    const data = await registerResp.json();
    apiKey = data.apiKey ?? null;
    console.log(`   Agent registered. API key: ${apiKey?.slice(0, 12)}...`);
  } else {
    console.log(`   Registration failed (${registerResp.status}). Using unauthenticated mode.`);
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(apiKey ? { "X-API-Key": apiKey } : {}),
  };

  // 2. Browse marketplace
  console.log("\n2. Browsing marketplace...");
  const browseResp = await fetch(
    `${BASE_URL}/api/ai-memory/vectors?category=nlp&sortBy=rating&limit=5`
  );
  if (browseResp.ok) {
    const result = await browseResp.json();
    const vectors = Array.isArray(result) ? result : result.data ?? [];
    console.log(`   Found ${vectors.length} vectors`);
    for (const v of vectors.slice(0, 3)) {
      console.log(`   - ${v.name ?? v.title ?? "untitled"}`);
    }
  } else {
    console.log(`   Browse failed (${browseResp.status})`);
  }

  // 3. Search knowledge packages
  console.log("\n3. Searching knowledge packages...");
  for (const packageType of ["vector", "memory", "chain"] as const) {
    const resp = await fetch(`${BASE_URL}/api/trpc/packages.browsePackages`, {
      method: "POST",
      headers,
      body: JSON.stringify({ packageType, limit: 3 }),
    });
    let count = 0;
    if (resp.ok) {
      const json = await resp.json();
      const packages = json.result?.data;
      count = Array.isArray(packages) ? packages.length : 0;
    }
    console.log(`   ${packageType.padEnd(8)} packages: ${count} found`);
  }

  // 4. Check W-Matrix cross-model compatibility
  console.log("\n4. Checking cross-model compatibility...");
  const compatResp = await fetch(`${BASE_URL}/api/trpc/latentmas.checkCompatibility`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      sourceModel: "gpt-4",
      targetModel: "claude-3-opus",
    }),
  });
  if (compatResp.ok) {
    const result = await compatResp.json();
    const compatible = result.result?.data?.compatible ?? "unknown";
    console.log(`   GPT-4 → Claude-3-Opus: ${compatible}`);
  } else {
    console.log(`   Compatibility check returned ${compatResp.status}`);
  }

  console.log("\nDone! See examples/typescript/mcp_collaboration.ts for multi-agent workflows.");
}

main().catch(console.error);
