#!/bin/bash

# GitHub Actions Environment Validation Script
# 用于验证 production-backend environment 中的所有必要变量
# 执行: bash scripts/verify-github-env.sh

set -e

echo "=========================================="
echo "GitHub Actions Environment Verification"
echo "=========================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查 production-backend environment 中的变量
# 注: 这个脚本可以在 CI/CD 中运行来验证所有必需的 env vars 都已设置

REQUIRED_VARS=(
  "OAUTH_CALLBACK_URL"
  "GOOGLE_CLIENT_ID"
  "GOOGLE_CLIENT_SECRET"
  "GITHUB_CLIENT_ID"
  "GITHUB_CLIENT_SECRET"
  "VITE_API_URL"
  "DATABASE_URL"
  "JWT_SECRET"
  "AWS_ACCESS_KEY_ID"
  "AWS_SECRET_ACCESS_KEY"
  "RESEND_API_KEY"
  "STRIPE_SECRET_KEY"
  "STRIPE_WEBHOOK_SECRET"
)

echo "${BLUE}Checking environment variables in .env files...${NC}"
echo ""

MISSING_COUNT=0
for var in "${REQUIRED_VARS[@]}"; do
  if grep -q "^${var}=" .env .env.production 2>/dev/null; then
    VALUE=$(grep "^${var}=" .env .env.production 2>/dev/null | head -1 | cut -d '=' -f 2)
    # Mask sensitive values
    if [[ "$var" == *"SECRET"* ]] || [[ "$var" == *"KEY"* ]] || [[ "$var" == *"TOKEN"* ]] || [[ "$var" == *"PASSWORD"* ]]; then
      if [ -z "$VALUE" ]; then
        echo -e "${RED}✗${NC} ${var}=<EMPTY>"
        ((MISSING_COUNT++))
      else
        echo -e "${GREEN}✓${NC} ${var}=<populated>"
      fi
    else
      if [ -z "$VALUE" ]; then
        echo -e "${RED}✗${NC} ${var}=<EMPTY>"
        ((MISSING_COUNT++))
      else
        echo -e "${GREEN}✓${NC} ${var}=${VALUE}"
      fi
    fi
  else
    echo -e "${YELLOW}?${NC} ${var}=<NOT FOUND>"
    ((MISSING_COUNT++))
  fi
done

echo ""
echo "=========================================="
if [ $MISSING_COUNT -eq 0 ]; then
  echo -e "${GREEN}✓ All environment variables are configured!${NC}"
else
  echo -e "${RED}✗ Missing or empty variables: ${MISSING_COUNT}${NC}"
  echo ""
  echo "Please ensure all variables are set in:"
  echo "  - .env (for local development)"
  echo "  - .env.production (for Vercel)"
  echo "  - GitHub Secrets (for GitHub Actions)"
  echo "  - EC2 ~/.env (for production backend)"
  exit 1
fi

# 特定验证
echo ""
echo "${BLUE}Specific validations:${NC}"
echo ""

# 验证 OAUTH_CALLBACK_URL
OAUTH_URL=$(grep "^OAUTH_CALLBACK_URL=" .env .env.production 2>/dev/null | head -1 | cut -d '=' -f 2)
if [[ "$OAUTH_URL" == "https://api.awareness.market" ]]; then
  echo -e "${GREEN}✓${NC} OAUTH_CALLBACK_URL points to production domain"
elif [[ "$OAUTH_URL" == "http://localhost"* ]]; then
  echo -e "${YELLOW}⚠${NC} OAUTH_CALLBACK_URL is set to localhost (OK for local dev)"
else
  echo -e "${RED}✗${NC} OAUTH_CALLBACK_URL has unexpected value: $OAUTH_URL"
fi

# 验证 VITE_API_URL
VITE_URL=$(grep "^VITE_API_URL=" .env .env.production 2>/dev/null | head -1 | cut -d '=' -f 2)
if [[ "$VITE_URL" == "https://api.awareness.market" ]]; then
  echo -e "${GREEN}✓${NC} VITE_API_URL points to production backend"
elif [[ "$VITE_URL" == "" ]]; then
  echo -e "${YELLOW}⚠${NC} VITE_API_URL is empty (OK for local dev, uses relative /api/trpc)"
else
  echo -e "${YELLOW}⚠${NC} VITE_API_URL: $VITE_URL"
fi

echo ""
echo "=========================================="
echo "Verification complete!"
echo "=========================================="
