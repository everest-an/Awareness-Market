#!/bin/bash

################################################################################
# Awareness Market - Backend Deployment Script
# 
# This script automates the deployment of the backend API to EC2.
# It handles building, uploading, and restarting the PM2 service.
#
# Usage:
#   ./scripts/deploy-backend.sh
#
# Prerequisites:
#   - SSH key configured (~/.ssh/awareness-key.pem)
#   - EC2 instance accessible
#   - PM2 configured on EC2
################################################################################

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
EC2_HOST="ec2-user@44.220.181.78"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/awareness-key.pem}"
REMOTE_DIR="/home/ec2-user/Awareness-Market"
LOCAL_BUILD_DIR="./dist"

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Awareness Market Backend Deploy${NC}"
echo -e "${GREEN}================================${NC}"
echo ""

# Step 1: Check prerequisites
echo -e "${YELLOW}[1/6] Checking prerequisites...${NC}"
if [ ! -f "$SSH_KEY" ]; then
    echo -e "${RED}Error: SSH key not found at $SSH_KEY${NC}"
    echo "Please set SSH_KEY environment variable or place key at ~/.ssh/awareness-key.pem"
    exit 1
fi

if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}Error: pnpm is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites OK${NC}"
echo ""

# Step 2: Install dependencies
echo -e "${YELLOW}[2/6] Installing dependencies...${NC}"
pnpm install --frozen-lockfile
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# Step 3: Generate Prisma client
echo -e "${YELLOW}[3/6] Generating Prisma client...${NC}"
npx prisma generate
echo -e "${GREEN}✓ Prisma client generated${NC}"
echo ""

# Step 4: Build backend
echo -e "${YELLOW}[4/6] Building backend...${NC}"
# Only build backend, skip frontend to save time
npx esbuild server/_core/index.ts \
  --bundle \
  --platform=node \
  --target=node20 \
  --outfile=dist/index.js \
  --external:@prisma/client \
  --external:better-sqlite3 \
  --external:@tensorflow/tfjs-node

if [ ! -f "dist/index.js" ]; then
    echo -e "${RED}Error: Build failed, dist/index.js not found${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Backend built successfully${NC}"
echo ""

# Step 5: Upload to EC2
echo -e "${YELLOW}[5/6] Uploading to EC2...${NC}"
ssh -i "$SSH_KEY" "$EC2_HOST" "mkdir -p $REMOTE_DIR/dist"

# Upload built file
scp -i "$SSH_KEY" dist/index.js "$EC2_HOST:$REMOTE_DIR/dist/"

# Upload package.json and prisma schema
scp -i "$SSH_KEY" package.json "$EC2_HOST:$REMOTE_DIR/"
scp -i "$SSH_KEY" -r prisma "$EC2_HOST:$REMOTE_DIR/"

# Upload PM2 config if it exists
if [ -f "ecosystem.config.cjs" ]; then
    scp -i "$SSH_KEY" ecosystem.config.cjs "$EC2_HOST:$REMOTE_DIR/"
fi

echo -e "${GREEN}✓ Files uploaded${NC}"
echo ""

# Step 6: Restart PM2 service
echo -e "${YELLOW}[6/6] Restarting PM2 service...${NC}"
ssh -i "$SSH_KEY" "$EC2_HOST" << 'ENDSSH'
cd /home/ec2-user/Awareness-Market

# Install dependencies on server (only production)
pnpm install --prod --frozen-lockfile

# Generate Prisma client on server
npx prisma generate

# Restart PM2
pm2 restart ecosystem.config.cjs || pm2 start ecosystem.config.cjs

# Show status
pm2 status
ENDSSH

echo -e "${GREEN}✓ PM2 service restarted${NC}"
echo ""

# Step 7: Verify deployment
echo -e "${YELLOW}Verifying deployment...${NC}"
sleep 5
if curl -f -s http://44.220.181.78:3001/api-docs/ > /dev/null; then
    echo -e "${GREEN}✓ Deployment successful! API is responding.${NC}"
    echo -e "${GREEN}  URL: http://44.220.181.78:3001/api-docs/${NC}"
else
    echo -e "${RED}⚠ Warning: API is not responding yet. Check PM2 logs:${NC}"
    echo -e "${YELLOW}  ssh -i $SSH_KEY $EC2_HOST 'pm2 logs'${NC}"
fi

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}================================${NC}"
