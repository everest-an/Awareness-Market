# NPM Publishing Guide for @awareness-market/mcp-server

This guide walks you through publishing the Awareness MCP Server to npm registry.

## Prerequisites

### 1. Create npm Account
Visit https://www.npmjs.com/signup and create a free account.

### 2. Verify Email
Check your email and verify your npm account.

### 3. Install npm CLI (Already Installed)
```bash
npm --version  # Should show 10.9.0 or higher
```

## Publishing Steps

### Step 1: Login to npm
```bash
cd /home/ubuntu/latentmind-marketplace/mcp-server
npm login
```

You'll be prompted for:
- Username: (your npm username)
- Password: (your npm password)
- Email: (your verified email)
- One-time password: (if 2FA is enabled)

### Step 2: Verify Package Configuration

Check `package.json` is properly configured:
```bash
cat package.json
```

Key fields to verify:
- ✅ `name`: "@awareness-market/mcp-server"
- ✅ `version`: "0.1.0"
- ✅ `main`: "dist/index.js"
- ✅ `types`: "dist/index.d.ts"
- ✅ `files`: ["dist", "README.md"]
- ✅ `license`: "MIT"

### Step 3: Build the Package
```bash
pnpm build
```

Verify dist files exist:
```bash
ls -la dist/
# Should show: index.js, index.d.ts, index.js.map, index.d.ts.map
```

### Step 4: Test Package Locally (Optional)
```bash
# Create a test installation
npm pack
# This creates awareness-market-mcp-server-0.1.0.tgz

# Test in another directory
cd /tmp
npm install /home/ubuntu/latentmind-marketplace/mcp-server/awareness-market-mcp-server-0.1.0.tgz
```

### Step 5: Publish to npm
```bash
cd /home/ubuntu/latentmind-marketplace/mcp-server
npm publish --access public
```

**Note:** The `--access public` flag is required for scoped packages (@awareness-market/...) to be publicly accessible.

### Step 6: Verify Publication
Visit: https://www.npmjs.com/package/@awareness-market/mcp-server

Or check via CLI:
```bash
npm view @awareness-market/mcp-server
```

## Post-Publication

### Update Documentation
Add installation instructions to README.md:
```bash
npm install -g @awareness-market/mcp-server
```

### Tag the Release
```bash
cd /home/ubuntu/latentmind-marketplace
git tag -a mcp-v0.1.0 -m "Release MCP Server v0.1.0"
git push origin mcp-v0.1.0
```

### Announce the Release
- Update Awareness Market homepage with npm installation instructions
- Post on GitHub Discussions
- Share on social media (Twitter, LinkedIn)

## Updating the Package

When you make changes and want to publish a new version:

### 1. Update Version Number
```bash
cd mcp-server
npm version patch  # 0.1.0 -> 0.1.1 (bug fixes)
# OR
npm version minor  # 0.1.0 -> 0.2.0 (new features)
# OR
npm version major  # 0.1.0 -> 1.0.0 (breaking changes)
```

### 2. Rebuild and Publish
```bash
pnpm build
npm publish --access public
```

## Troubleshooting

### Error: "You must be logged in to publish packages"
```bash
npm login
```

### Error: "Package name too similar to existing package"
Change the package name in `package.json` to something unique.

### Error: "You do not have permission to publish"
Make sure you're logged in with the correct account:
```bash
npm whoami
```

### Error: "Version already exists"
Update the version number:
```bash
npm version patch
```

## Package Scope

The package is published under the `@awareness-market` scope. To create this scope:

1. Go to https://www.npmjs.com/org/create
2. Create organization named "awareness-market"
3. Make it public (free)

Alternatively, you can publish without a scope:
- Change `"name"` in `package.json` to `"awareness-mcp-server"` (without @)
- Publish with `npm publish` (no --access flag needed)

## Security Best Practices

### Use 2FA (Two-Factor Authentication)
```bash
npm profile enable-2fa auth-and-writes
```

### Use Access Tokens for CI/CD
Instead of password, use access tokens:
1. Go to https://www.npmjs.com/settings/YOUR_USERNAME/tokens
2. Create a new token (Automation type)
3. Use in CI/CD: `npm config set //registry.npmjs.org/:_authToken=$NPM_TOKEN`

## Package Statistics

After publication, you can track:
- Downloads: https://npm-stat.com/charts.html?package=@awareness-market/mcp-server
- Dependencies: https://npmgraph.js.org/?q=@awareness-market/mcp-server

## Support

If you encounter issues:
- npm support: https://www.npmjs.com/support
- Awareness Market: https://awareness.market/about

---

**Ready to publish?** Follow the steps above and your MCP server will be available to the world! 🚀
