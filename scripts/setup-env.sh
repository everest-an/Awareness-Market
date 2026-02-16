#!/bin/bash

###############################################################################
# 环境变量配置脚本
# 自动配置 .env 文件以使用自部署 LLM
###############################################################################

set -e

# 颜色输出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# 脚本目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_ROOT/.env"
ENV_EXAMPLE="$PROJECT_ROOT/.env.example"

log_info "======================================"
log_info "  环境变量配置脚本"
log_info "======================================"
echo

# 检查 .env 文件
if [ ! -f "$ENV_FILE" ]; then
    log_info "未找到 .env 文件，从 .env.example 复制..."
    cp "$ENV_EXAMPLE" "$ENV_FILE"
    log_success ".env 文件已创建"
fi

# 收集配置信息
echo
log_info "请提供以下配置信息："
echo

# vLLM 服务器地址
read -p "vLLM 服务器地址 (例: https://your-pod-id-8000.proxy.runpod.net): " VLLM_BASE_URL
if [ -z "$VLLM_BASE_URL" ]; then
    VLLM_BASE_URL="http://localhost:8000"
    log_warning "使用默认地址: $VLLM_BASE_URL"
fi

# 模型名称
read -p "模型名称 (默认: llama-3.1-8b): " VLLM_MODEL_NAME
if [ -z "$VLLM_MODEL_NAME" ]; then
    VLLM_MODEL_NAME="llama-3.1-8b"
fi

# RunPod 配置（可选）
echo
log_info "RunPod 配置（可选，用于自动启停）："
read -p "RunPod API Key (留空跳过): " RUNPOD_API_KEY
if [ ! -z "$RUNPOD_API_KEY" ]; then
    read -p "RunPod Pod ID: " RUNPOD_POD_ID
fi

# 成本追踪配置
echo
log_info "成本追踪配置："
echo "选项:"
echo "  1. runpod-rtx-4090-spot (推荐, $0.34/hr)"
echo "  2. runpod-rtx-4090 ($0.44/hr)"
echo "  3. runpod-a100 ($1.89/hr)"
echo "  4. vast-ai-rtx-4090 ($0.29/hr)"
echo "  5. aws-g5-xlarge ($1.01/hr)"
read -p "选择成本追踪提供商 (1-5, 默认: 1): " COST_PROVIDER_CHOICE

case $COST_PROVIDER_CHOICE in
    2) LLM_COST_PROVIDER="runpod-rtx-4090" ;;
    3) LLM_COST_PROVIDER="runpod-a100" ;;
    4) LLM_COST_PROVIDER="vast-ai-rtx-4090" ;;
    5) LLM_COST_PROVIDER="aws-g5-xlarge" ;;
    *) LLM_COST_PROVIDER="runpod-rtx-4090-spot" ;;
esac

# 更新 .env 文件
echo
log_info "更新 .env 文件..."

# 启用自部署 LLM
if grep -q "^USE_SELF_HOSTED_LLM=" "$ENV_FILE"; then
    sed -i "s|^USE_SELF_HOSTED_LLM=.*|USE_SELF_HOSTED_LLM=true|" "$ENV_FILE"
else
    echo "USE_SELF_HOSTED_LLM=true" >> "$ENV_FILE"
fi

# 设置 vLLM 服务器地址
if grep -q "^VLLM_BASE_URL=" "$ENV_FILE"; then
    sed -i "s|^VLLM_BASE_URL=.*|VLLM_BASE_URL=$VLLM_BASE_URL|" "$ENV_FILE"
else
    echo "VLLM_BASE_URL=$VLLM_BASE_URL" >> "$ENV_FILE"
fi

# 设置模型名称
if grep -q "^VLLM_MODEL_NAME=" "$ENV_FILE"; then
    sed -i "s|^VLLM_MODEL_NAME=.*|VLLM_MODEL_NAME=$VLLM_MODEL_NAME|" "$ENV_FILE"
else
    echo "VLLM_MODEL_NAME=$VLLM_MODEL_NAME" >> "$ENV_FILE"
fi

# 设置 RunPod 配置（如果提供）
if [ ! -z "$RUNPOD_API_KEY" ]; then
    if grep -q "^RUNPOD_API_KEY=" "$ENV_FILE"; then
        sed -i "s|^# *RUNPOD_API_KEY=.*|RUNPOD_API_KEY=$RUNPOD_API_KEY|" "$ENV_FILE"
    else
        echo "RUNPOD_API_KEY=$RUNPOD_API_KEY" >> "$ENV_FILE"
    fi

    if grep -q "^RUNPOD_POD_ID=" "$ENV_FILE"; then
        sed -i "s|^# *RUNPOD_POD_ID=.*|RUNPOD_POD_ID=$RUNPOD_POD_ID|" "$ENV_FILE"
    else
        echo "RUNPOD_POD_ID=$RUNPOD_POD_ID" >> "$ENV_FILE"
    fi
fi

# 设置成本追踪提供商
if grep -q "^LLM_COST_PROVIDER=" "$ENV_FILE"; then
    sed -i "s|^LLM_COST_PROVIDER=.*|LLM_COST_PROVIDER=$LLM_COST_PROVIDER|" "$ENV_FILE"
else
    echo "LLM_COST_PROVIDER=$LLM_COST_PROVIDER" >> "$ENV_FILE"
fi

log_success ".env 文件已更新"

# 显示配置摘要
echo
log_success "======================================"
log_success "  配置完成！"
log_success "======================================"
echo
log_info "配置摘要："
log_info "  USE_SELF_HOSTED_LLM: true"
log_info "  VLLM_BASE_URL: $VLLM_BASE_URL"
log_info "  VLLM_MODEL_NAME: $VLLM_MODEL_NAME"
log_info "  LLM_COST_PROVIDER: $LLM_COST_PROVIDER"

if [ ! -z "$RUNPOD_API_KEY" ]; then
    log_info "  RUNPOD_API_KEY: ****${RUNPOD_API_KEY: -4}"
    log_info "  RUNPOD_POD_ID: $RUNPOD_POD_ID"
fi

echo
log_info "下一步："
log_info "1. 测试连接: npm run dev"
log_info "2. 访问: http://localhost:3000/api/trpc/latentmas.trueLatentMAS.testSelfHostedHealth"
log_info "3. 开始训练 W-Matrix！"

echo
log_success "配置完成！"
