#!/bin/bash
# Awareness Market - 启动 Go 微服务 (Linux/macOS)

echo "==== 启动 Awareness Market Go 微服务 ===="
echo ""

# 检查 Go
go version || { echo "Go 未安装"; exit 1; }

# 启动各个服务
echo "启动 Vector Operations (8083)..."
cd go-services/vector-operations
go run ./cmd/main.go > /tmp/vector.log 2>&1 &
echo $! > /tmp/vector.pid
cd ../..
sleep 2

echo "启动 Memory Exchange (8080)..."
cd go-services/memory-exchange
go run ./cmd/main.go > /tmp/memory.log 2>&1 &
echo $! > /tmp/memory.pid
cd ../..
sleep 2

echo "启动 W-Matrix Marketplace (8081)..."
cd go-services/w-matrix-marketplace
go run ./cmd/main.go > /tmp/wmatrix.log 2>&1 &
echo $! > /tmp/wmatrix.pid
cd ../..
sleep 2

echo ""
echo "==== 检查服务 ===="
echo ""

curl -s http://localhost:8083/health > /dev/null && echo "✓ Vector Operations 正常"
curl -s http://localhost:8080/health > /dev/null && echo "✓ Memory Exchange 正常"
curl -s http://localhost:8081/health > /dev/null && echo "✓ W-Matrix Marketplace 正常"

echo ""
echo "✅ Go 微服务启动完成！"
echo ""
echo "URL:"
echo "  Vector: http://localhost:8083/health"
echo "  Memory: http://localhost:8080/health"
echo "  W-Matrix: http://localhost:8081/health"
