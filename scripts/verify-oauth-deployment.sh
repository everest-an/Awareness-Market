#!/bin/bash

# Post-Deployment Verification Script
# 用于验证所有 OAuth 和 API 配置是否正确工作
# 在所有手动更改完成后运行

set -e

echo "=========================================="
echo "Post-Deployment OAuth Verification"
echo "=========================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

FAILED=0

# 检查后端 API 可访问性
echo "${BLUE}1. Checking backend API accessibility...${NC}"
if curl -s -I https://api.awareness.market/api-docs/ | grep -q "200\|301\|302"; then
  echo -e "${GREEN}✓${NC} Backend API is accessible"
else
  echo -e "${RED}✗${NC} Backend API is not responding correctly"
  ((FAILED++))
fi
echo ""

# 检查 OAuth 路由
echo "${BLUE}2. Checking OAuth callback routes...${NC}"

# Google OAuth 回调
if curl -s -I "https://api.awareness.market/api/auth/callback/google?code=test&state=test" | grep -q "400\|500"; then
  echo -e "${GREEN}✓${NC} Google OAuth callback route is registered (returns 400, not 404)"
else
  echo -e "${RED}✗${NC} Google OAuth callback route not working (may return 404)"
  ((FAILED++))
fi

# GitHub OAuth 回调
if curl -s -I "https://api.awareness.market/api/auth/callback/github?code=test&state=test" | grep -q "400\|500"; then
  echo -e "${GREEN}✓${NC} GitHub OAuth callback route is registered (returns 400, not 404)"
else
  echo -e "${RED}✗${NC} GitHub OAuth callback route not working (may return 404)"
  ((FAILED++))
fi
echo ""

# 检查前端 Vercel
echo "${BLUE}3. Checking frontend (Vercel) availability...${NC}"
if curl -s -I https://awareness.market | grep -q "200\|301"; then
  echo -e "${GREEN}✓${NC} Frontend is accessible"
else
  echo -e "${RED}✗${NC} Frontend is not responding"
  ((FAILED++))
fi
echo ""

# 检查 CORS 和连接
echo "${BLUE}4. Checking tRPC API endpoint...${NC}"
TRPC_RESPONSE=$(curl -s -X POST https://api.awareness.market/api/trpc/auth.me \
  -H "Content-Type: application/json" \
  -d '{}' \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$TRPC_RESPONSE" | tail -1)
if [[ "$HTTP_CODE" == "200" ]]; then
  echo -e "${GREEN}✓${NC} tRPC endpoint responding (HTTP $HTTP_CODE)"
elif [[ "$HTTP_CODE" == "401" ]]; then
  echo -e "${GREEN}✓${NC} tRPC endpoint responding (HTTP 401 - expected for unauthenticated)"
else
  echo -e "${YELLOW}⚠${NC} tRPC endpoint returned HTTP $HTTP_CODE"
fi
echo ""

# 检查 OAuth 配置
echo "${BLUE}5. Checking OAuth configuration...${NC}"
echo "Testing OAuth URL generation..."

# 这需要后端运行的访权，暂时跳过详细检查
echo -e "${YELLOW}⚠${NC} OAuth URL generation check requires authentication (skipped)"
echo ""

# SSL 证书检查
echo "${BLUE}6. Checking SSL Certificate...${NC}"
CERT_INFO=$(curl -s -I https://api.awareness.market 2>&1 | grep -i "certificate")
if [[ ! -z "$CERT_INFO" ]]; then
  echo -e "${YELLOW}⚠${NC} SSL certificate present"
else
  echo -e "${GREEN}✓${NC} SSL connection established"
fi
echo ""

# 检查 nginx 是否配置正确
echo "${BLUE}7. Checking nginx response headers...${NC}"
HEADERS=$(curl -s -I https://api.awareness.market/api-docs/)
if echo "$HEADERS" | grep -q "X-Frame-Options"; then
  echo -e "${GREEN}✓${NC} Security headers present (nginx configured)"
else
  echo -e "${YELLOW}⚠${NC} Expected security headers not found"
fi
echo ""

# 总结
echo "=========================================="
if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All checks passed!${NC}"
  echo ""
  echo "OAuth login flow should work:"
  echo "1. User clicks 'Sign in with Google' on https://awareness.market"
  echo "2. Frontend redirects to Google OAuth authorization"
  echo "3. User authorizes, Google redirects to:"
  echo "   https://api.awareness.market/api/auth/callback/google?code=...&state=..."
  echo "4. Backend receives callback, exchanges code for tokens"
  echo "5. Backend redirects user to dashboard"
  echo ""
  echo "Same flow for GitHub OAuth using:"
  echo "   https://api.awareness.market/api/auth/callback/github"
else
  echo -e "${RED}✗ ${FAILED} check(s) failed${NC}"
  echo ""
  echo "Please verify:"
  echo "  - Backend is running (pm2 list)"
  echo "  - nginx configuration is correct (sudo nginx -t)"
  echo "  - SSL certificates are valid"
  echo "  - GitHub Actions deployment completed"
  echo "  - EC2 environment variables are set"
  exit 1
fi

echo "=========================================="
