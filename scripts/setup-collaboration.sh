#!/bin/bash

###############################################################################
# AI Collaboration Setup Script
#
# Quick setup for multi-client, multi-project AI collaboration
###############################################################################

set -e

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║     AI Collaboration System - Setup                       ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Build MCP Collaboration Server
echo -e "${BLUE}[1/4]${NC} Building MCP Collaboration Server..."
cd mcp-server

if ! command -v pnpm &> /dev/null; then
    echo -e "${YELLOW}Warning: pnpm not found. Using npm instead.${NC}"
    npm install
    npm run build:collab
else
    pnpm install
    pnpm run build:collab
fi

echo -e "${GREEN}✓${NC} MCP server built successfully"
echo ""

# Step 2: Build Project Manager
echo -e "${BLUE}[2/4]${NC} Building Project Manager..."
npx tsc project-manager.ts --outDir dist --module ESNext --moduleResolution node --esModuleInterop

echo -e "${GREEN}✓${NC} Project manager built successfully"
echo ""

# Step 3: Create example project
echo -e "${BLUE}[3/4]${NC} Creating example project..."

node dist/project-manager.js create \
  "Awareness Platform Development" \
  "client_awareness" \
  "Awareness Market Team"

echo ""

# Step 4: List projects
echo -e "${BLUE}[4/4]${NC} Listing projects..."
node dist/project-manager.js list

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Setup Complete!                                          ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Next steps:"
echo "  1. Check .ai-collaboration/projects.json for your project details"
echo "  2. Generate MCP config for your agents:"
echo "     node mcp-server/dist/project-manager.js config <project-id> frontend"
echo "  3. Copy the config to your AI agent's configuration file"
echo ""
echo "Documentation:"
echo "  - AI_COLLABORATION_QUICKSTART.md"
echo "  - AI_COLLABORATION_MULTI_CLIENT.md"
echo ""
