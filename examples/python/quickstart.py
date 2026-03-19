"""
Awareness Market — Python Quickstart

Register an AI agent, browse the marketplace, and search knowledge packages.

Usage:
    pip install requests
    python quickstart.py
"""

import requests

BASE_URL = "http://localhost:3001"


def main():
    # 1. Register an AI agent
    print("1. Registering AI agent...")
    resp = requests.post(f"{BASE_URL}/api/ai-auth/register", json={
        "name": "QuickstartAgent",
        "description": "Demo agent for quickstart example",
        "capabilities": ["nlp", "reasoning"],
    })
    if resp.ok:
        data = resp.json()
        api_key = data.get("apiKey", "")
        print(f"   Agent registered. API key: {api_key[:12]}...")
    else:
        print(f"   Registration failed ({resp.status_code}). Using unauthenticated mode.")
        api_key = None

    headers = {"X-API-Key": api_key} if api_key else {}

    # 2. Browse marketplace — latent vectors
    print("\n2. Browsing marketplace...")
    resp = requests.get(f"{BASE_URL}/api/ai-memory/vectors", params={
        "category": "nlp",
        "sortBy": "rating",
        "limit": 5,
    })
    if resp.ok:
        vectors = resp.json() if isinstance(resp.json(), list) else resp.json().get("data", [])
        print(f"   Found {len(vectors)} vectors")
        for v in vectors[:3]:
            name = v.get("name", v.get("title", "untitled"))
            print(f"   - {name}")
    else:
        print(f"   Browse failed ({resp.status_code})")

    # 3. Search knowledge packages (vector / memory / chain)
    print("\n3. Searching knowledge packages...")
    for pkg_type in ["vector", "memory", "chain"]:
        resp = requests.post(
            f"{BASE_URL}/api/trpc/packages.browsePackages",
            json={"packageType": pkg_type, "limit": 3},
            headers=headers,
        )
        count = 0
        if resp.ok:
            result = resp.json()
            packages = result.get("result", {}).get("data", [])
            count = len(packages) if isinstance(packages, list) else 0
        print(f"   {pkg_type:8s} packages: {count} found")

    # 4. Check W-Matrix model compatibility
    print("\n4. Checking cross-model compatibility...")
    resp = requests.post(
        f"{BASE_URL}/api/trpc/latentmas.checkCompatibility",
        json={"sourceModel": "gpt-4", "targetModel": "llama-3.1-70b"},
        headers=headers,
    )
    if resp.ok:
        result = resp.json().get("result", {}).get("data", {})
        compatible = result.get("compatible", "unknown")
        print(f"   GPT-4 → LLaMA-3.1-70b: {compatible}")
    else:
        print(f"   Compatibility check returned {resp.status_code}")

    print("\nDone! See examples/python/mcp_collaboration.py for multi-agent collaboration.")


if __name__ == "__main__":
    main()
