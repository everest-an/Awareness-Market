#!/bin/bash

# 颜色输出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}🚀 Awareness Market Go 微服务启动器${NC}"
echo -e "${BLUE}========================================${NC}"

# 检查 Go 是否安装
if ! command -v go &> /dev/null; then
    echo -e "${YELLOW}❌ Go 未安装。请先安装 Go 1.21+${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Go 已安装: $(go version)${NC}"
echo ""

# 定义服务
declare -A SERVICES=(
    ["vector-operations"]="8083"
    ["memory-exchange"]="8080"
    ["w-matrix-marketplace"]="8081"
)

# 检查端口是否占用
check_port() {
    local port=$1
    if lsof -i :$port &>/dev/null; then
        return 0  # 端口被占用
    else
        return 1  # 端口空闲
    fi
}

# 启动服务
start_service() {
    local service=$1
    local port=$2
    local service_dir="go-services/$service"

    if [ ! -d "$service_dir" ]; then
        echo -e "${YELLOW}⚠️  目录不存在: $service_dir${NC}"
        return
    fi

    if check_port $port; then
        echo -e "${YELLOW}⚠️  端口 $port 已被占用 ($service)${NC}"
        echo -e "${YELLOW}   尝试杀死现有进程...${NC}"
        lsof -ti :$port | xargs kill -9 2>/dev/null || true
        sleep 1
    fi

    echo -e "${BLUE}启动 $service (端口 $port)...${NC}"
    cd "$service_dir"
    
    # 后台启动服务
    go run ./cmd/main.go > "/tmp/${service}.log" 2>&1 &
    local PID=$!
    
    # 等待服务启动
    sleep 3
    
    # 检查服务是否成功启动
    if kill -0 $PID 2>/dev/null; then
        echo -e "${GREEN}✓ $service 已启动 (PID: $PID)${NC}"
        echo -e "${GREEN}  Swagger: http://localhost:$port/swagger/index.html${NC}"
    else
        echo -e "${YELLOW}❌ $service 启动失败，查看日志:${NC}"
        cat "/tmp/${service}.log"
    fi
    
    cd "$SCRIPT_DIR"
    echo ""
}

# 启动所有服务
echo -e "${BLUE}启动所有 Go 微服务...${NC}"
echo ""

for service in "${!SERVICES[@]}"; do
    port=${SERVICES[$service]}
    start_service "$service" "$port"
done

# 健康检查
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}执行健康检查...${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

health_check() {
    local port=$1
    local service=$2
    
    for i in {1..5}; do
        if curl -s "http://localhost:$port/health" > /dev/null 2>&1; then
            status=$(curl -s "http://localhost:$port/health" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
            echo -e "${GREEN}✓ $service 健康 (状态: $status)${NC}"
            return 0
        fi
        echo -e "${YELLOW}⏳ 等待 $service 启动... (${i}/5)${NC}"
        sleep 1
    done
    
    echo -e "${YELLOW}❌ $service 未响应${NC}"
    return 1
}

health_check 8083 "Vector Operations"
health_check 8080 "Memory Exchange"
health_check 8081 "W-Matrix Marketplace"

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✓ Go 微服务启动完成！${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "📊 服务状态:"
echo "  Vector Operations   (Port 8083): http://localhost:8083/health"
echo "  Memory Exchange     (Port 8080): http://localhost:8080/health"
echo "  W-Matrix Marketplace(Port 8081): http://localhost:8081/health"
echo ""
echo "📖 Swagger 文档:"
echo "  Memory Exchange: http://localhost:8080/swagger/index.html"
echo ""
echo "⚠️  要停止所有服务，请使用: pkill -f 'go run'"
echo ""
