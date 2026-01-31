#!/bin/bash
# ============================================================
# Credential Rotation Script
# ============================================================
# This script helps you rotate all sensitive credentials
# Run each section manually and update your .env file
# ============================================================

echo "=========================================="
echo "AWARENESS MARKET - 凭证轮换指南"
echo "=========================================="

echo ""
echo "1. JWT_SECRET 轮换"
echo "----------------------------------------"
echo "生成新密钥:"
echo "  openssl rand -base64 64"
echo ""
NEW_JWT=$(openssl rand -base64 64 2>/dev/null | tr -d '\n')
if [ -n "$NEW_JWT" ]; then
    echo "新 JWT_SECRET: $NEW_JWT"
fi

echo ""
echo "2. AWS 凭证轮换"
echo "----------------------------------------"
echo "步骤:"
echo "  1. 登录 AWS Console: https://console.aws.amazon.com/iam/"
echo "  2. 进入 IAM -> Users -> 你的用户"
echo "  3. Security credentials -> Create access key"
echo "  4. 复制新的 Access Key ID 和 Secret"
echo "  5. 删除旧的 Access Key"
echo ""

echo ""
echo "3. Resend API Key 轮换"
echo "----------------------------------------"
echo "步骤:"
echo "  1. 登录 Resend: https://resend.com/api-keys"
echo "  2. 点击 'Create API Key'"
echo "  3. 复制新密钥"
echo "  4. 删除旧密钥"
echo ""

echo ""
echo "4. Stripe 密钥轮换"
echo "----------------------------------------"
echo "步骤:"
echo "  1. 登录 Stripe: https://dashboard.stripe.com/apikeys"
echo "  2. 生成新的 Secret Key"
echo "  3. 更新 Webhook Secret"
echo ""

echo ""
echo "5. GitHub/Google OAuth 凭证"
echo "----------------------------------------"
echo "GitHub: https://github.com/settings/developers"
echo "Google: https://console.cloud.google.com/apis/credentials"
echo ""

echo ""
echo "6. 区块链私钥"
echo "----------------------------------------"
echo "⚠️ 警告: 如果私钥泄露,需要:"
echo "  1. 立即转移所有资产到新钱包"
echo "  2. 生成新钱包地址"
echo "  3. 更新所有合约的 owner/admin"
echo ""

echo "=========================================="
echo "完成后检查清单:"
echo "=========================================="
echo "[ ] 更新 .env 文件中的所有凭证"
echo "[ ] 重启所有服务"
echo "[ ] 验证服务正常运行"
echo "[ ] 删除旧凭证(AWS/Resend/Stripe控制台)"
echo "[ ] 更新 CI/CD 中的密钥 (GitHub Secrets)"
echo "[ ] 通知团队成员更新本地环境"
echo "=========================================="
