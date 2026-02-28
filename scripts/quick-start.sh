#!/bin/bash

echo ""
echo "========================================"
echo " Awareness Market - 快速启动"
echo "========================================"
echo ""

# 检查 .env
if [ ! -f .env ]; then
    echo "[WARN] .env 不存在，正在复制..."
    cp .env.example .env
    echo "[INFO] 请检查 .env 配置"
fi

# 检查 JWT_SECRET
if grep -q "JWT_SECRET=CHANGE_ME" .env || grep -q "JWT_SECRET=$" .env; then
    echo "[WARN] JWT_SECRET 需要配置"
    echo "[INFO] 正在生成..."
    NEW_SECRET=$(openssl rand -base64 64)
    if [ -n "$NEW_SECRET" ]; then
        # 更新 .env 中的 JWT_SECRET
        sed -i "s/JWT_SECRET=.*/JWT_SECRET=$NEW_SECRET/" .env
        echo "[OK] JWT_SECRET 已生成"
    fi
fi

# 安装依赖
echo ""
echo "[1/3] 安装依赖..."
pnpm install --silent

# 启动服务器
echo ""
echo "[2/3] 启动服务器..."
echo ""
echo "========================================"
echo " 服务器启动中..."
echo "========================================"
echo " 前端: http://localhost:5173"
echo " 后端: http://localhost:5000"
echo " Demo: http://localhost:5173/webmcp-demo.html"
echo "========================================"
echo ""
echo "[3/3] 按 Ctrl+C 停止服务器"
echo ""

# 启动
pnpm run dev
