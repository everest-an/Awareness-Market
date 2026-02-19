#!/bin/bash

# OAuth Configuration Verification Script
# This script verifies that all OAuth settings are correct for production

set -e

echo "🔍 OAuth Configuration Verification"
echo "===================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check 1: Local .env file
echo "${BLUE}1. Checking local .env configuration...${NC}"
if [ -f ".env" ]; then
  OAUTH_CALLBACK_URL=$(grep "^OAUTH_CALLBACK_URL=" .env | cut -d '=' -f 2)
  if [ -z "$OAUTH_CALLBACK_URL" ]; then
    echo "${YELLOW}⚠️  OAUTH_CALLBACK_URL not set in .env${NC}"
  else
    echo "${GREEN}✓${NC} OAUTH_CALLBACK_URL=$OAUTH_CALLBACK_URL"
  fi
  
  GOOGLE_CLIENT_ID=$(grep "^GOOGLE_CLIENT_ID=" .env | cut -d '=' -f 2)
  GITHUB_CLIENT_ID=$(grep "^GITHUB_CLIENT_ID=" .env | cut -d '=' -f 2)
  
  if [ -z "$GOOGLE_CLIENT_ID" ]; then
    echo "${YELLOW}⚠️  GOOGLE_CLIENT_ID not set in .env${NC}"
  else
    echo "${GREEN}✓${NC} GOOGLE_CLIENT_ID is set"
  fi
  
  if [ -z "$GITHUB_CLIENT_ID" ]; then
    echo "${YELLOW}⚠️  GITHUB_CLIENT_ID not set in .env${NC}"
  else
    echo "${GREEN}✓${NC} GITHUB_CLIENT_ID is set"
  fi
else
  echo "${RED}✗ .env file not found${NC}"
fi
echo ""

# Check 2: Server code
echo "${BLUE}2. Checking server OAuth route configuration...${NC}"
if grep -q "app.get(\"/api/auth/callback/:provider\"" server/_core/oauth.ts; then
  echo "${GREEN}✓${NC} OAuth route handler is configured correctly"
else
  echo "${RED}✗ OAuth route handler not found or incorrect${NC}"
  echo "   Expected: app.get(\"/api/auth/callback/:provider\", ...)"
fi

if grep -q "handleOAuthCallback" server/_core/oauth.ts; then
  echo "${GREEN}✓${NC} handleOAuthCallback function is being called"
else
  echo "${YELLOW}⚠️  handleOAuthCallback function not found in oauth.ts${NC}"
fi
echo ""

# Check 3: Frontend configuration
echo "${BLUE}3. Checking frontend OAuth integration...${NC}"
if grep -q "oauthAuthorizeUrl" client/src/pages/AuthPage.tsx; then
  echo "${GREEN}✓${NC} Frontend OAuth login is configured"
else
  echo "${RED}✗ Frontend OAuth login not found${NC}"
fi
echo ""

# Check 4: OAuth app configurations
echo "${BLUE}4. OAuth App Configuration URLs${NC}"
echo "=================================="
echo "📋 Please verify these settings in respective OAuth apps:"
echo ""
echo "GitHub OAuth App:"
echo "  URL: https://github.com/settings/developers"
echo "  Setting: Authorization callback URL"
echo "  Value: ${OAUTH_CALLBACK_URL:-https://api.awareness.market}/api/auth/callback/github"
echo ""
echo "Google OAuth App:"
echo "  URL: https://console.cloud.google.com/apis/credentials"
echo "  Setting: Authorized redirect URIs"
echo "  Value: ${OAUTH_CALLBACK_URL:-https://api.awareness.market}/api/auth/callback/google"
echo ""

# Check 5: Environment variable setup for CI/CD
echo "${BLUE}5. GitHub Actions Environment Setup${NC}"
echo "====================================="
echo "Verify that 'production-backend' environment has:"
echo "  - OAUTH_CALLBACK_URL = https://api.awareness.market"
echo "  - GOOGLE_CLIENT_ID = [your client id]"
echo "  - GOOGLE_CLIENT_SECRET = [your client secret]"
echo "  - GITHUB_CLIENT_ID = [your client id]"
echo "  - GITHUB_CLIENT_SECRET = [your client secret]"
echo ""
echo "See: https://github.com/everest-an/Awareness-Market/settings/environments"
echo ""

# Summary
echo "${YELLOW}Summary${NC}"
echo "======="
echo "✅ Code changes have been applied:"
echo "   - server/_core/oauth.ts: Route fixed to /api/auth/callback/:provider"
echo "   - .env: OAUTH_CALLBACK_URL updated to https://api.awareness.market"
echo ""
echo "⚠️  ACTION REQUIRED:"
echo "   1. Update GitHub OAuth App callback URL"
echo "   2. Update Google OAuth App redirect URI"  
echo "   3. Verify EC2 .env has all OAuth secrets"
echo "   4. Restart backend: pm2 restart awareness-api"
echo ""
echo "🧪 Test:"
echo "   1. Go to https://awareness.market"
echo "   2. Click 'Sign in with Google' or 'Sign in with GitHub'"
echo "   3. Approve authorization"
echo "   4. Should redirect to dashboard (no 404 error)"
