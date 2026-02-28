#!/bin/bash

################################################################################
# Awareness Market - One-Click Deployment Script
# 
# This script automates the deployment of both frontend and backend.
# - Backend is deployed to EC2 via SSH.
# - Frontend is deployed to Vercel via Vercel CLI.
#
# Usage:
#   ./deploy.sh [backend|frontend|all]
#
# Prerequisites:
#   - Vercel CLI installed and logged in
#   - SSH key configured (~/.ssh/awareness-key.pem)
#   - EC2 instance accessible
################################################################################

set -e

# Colors
RED=\'\033[0;31m\'
GREEN=\'\033[0;32m\'
YELLOW=\'\033[1;33m\'
NC=\'\033[0m\' # No Color

# Default to deploying all
DEPLOY_TARGET=${1:-all}

# Function to deploy backend
deploy_backend() {
    echo -e "${YELLOW}Deploying backend...${NC}"
    ./scripts/deploy-backend.sh
}

# Function to deploy frontend
deploy_frontend() {
    echo -e "${YELLOW}Deploying frontend...${NC}"
    if ! command -v vercel &> /dev/null; then
        echo -e "${RED}Error: Vercel CLI is not installed. Please run 'npm i -g vercel'${NC}"
        exit 1
    fi
    vercel --prod
}

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Awareness Market One-Click Deploy${NC}"
echo -e "${GREEN}================================${NC}"
echo ""

case $DEPLOY_TARGET in
    backend)
        deploy_backend
        ;;
    frontend)
        deploy_frontend
        ;;
    all)
        echo -e "${YELLOW}Deploying both frontend and backend...${NC}"
        deploy_backend
        deploy_frontend
        ;;
    *)
        echo -e "${RED}Invalid target. Usage: ./deploy.sh [backend|frontend|all]${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}================================${NC}"
