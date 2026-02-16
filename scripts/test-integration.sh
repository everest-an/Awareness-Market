#!/bin/bash

###############################################################################
# 集成测试脚本
# 测试自部署 LLM 集成是否正常工作
###############################################################################

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# API 基础地址
API_BASE="${API_BASE:-http://localhost:3000}"
TRPC_BASE="$API_BASE/api/trpc"

# 测试计数器
TESTS_PASSED=0
TESTS_FAILED=0

# 执行测试
run_test() {
    local test_name="$1"
    local endpoint="$2"
    local method="${3:-GET}"
    local data="$4"

    log_info "测试: $test_name"

    if [ "$method" = "POST" ]; then
        response=$(curl -s -X POST "$TRPC_BASE/$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data" || echo '{"error": "request failed"}')
    else
        response=$(curl -s "$TRPC_BASE/$endpoint" || echo '{"error": "request failed"}')
    fi

    if echo "$response" | jq -e '.result.data.success == true' > /dev/null 2>&1; then
        log_success "$test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        log_error "$test_name"
        echo "  响应: $response" | head -c 500
        echo
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# 主测试流程
main() {
    echo
    log_info "======================================"
    log_info "  自部署 LLM 集成测试"
    log_info "======================================"
    echo

    # 检查服务是否运行
    log_info "检查后端服务..."
    if ! curl -s "$API_BASE" > /dev/null 2>&1; then
        log_error "后端服务未运行"
        log_info "请先启动服务: npm run dev"
        exit 1
    fi
    log_success "后端服务运行中"
    echo

    # 测试 1: 健康检查
    run_test "自部署 LLM 健康检查" \
        "latentmas.trueLatentMAS.testSelfHostedHealth" \
        "GET"

    # 测试 2: 隐藏状态提取
    run_test "隐藏状态提取" \
        "latentmas.trueLatentMAS.testHiddenStateExtraction" \
        "POST" \
        '{"prompts": ["Hello, world!"], "layer": -2}'

    # 测试 3: RunPod 状态（如果启用）
    if [ ! -z "$RUNPOD_POD_ID" ]; then
        run_test "RunPod 状态查询" \
            "latentmas.trueLatentMAS.getRunPodStatus" \
            "GET"
    else
        log_warning "RunPod 未配置，跳过相关测试"
    fi

    # 测试 4: 成本统计
    run_test "成本统计查询" \
        "latentmas.trueLatentMAS.getCostStats" \
        "GET"

    # 测试 5: 支持的模型列表
    run_test "支持的模型列表" \
        "latentmas.trueLatentMAS.getSupportedModels" \
        "GET"

    # 显示测试结果
    echo
    log_info "======================================"
    log_info "  测试结果"
    log_info "======================================"
    echo
    log_info "通过: $TESTS_PASSED"
    log_info "失败: $TESTS_FAILED"
    echo

    if [ $TESTS_FAILED -eq 0 ]; then
        log_success "所有测试通过！集成成功！"
        exit 0
    else
        log_error "部分测试失败，请检查配置"
        exit 1
    fi
}

# 运行测试
main
