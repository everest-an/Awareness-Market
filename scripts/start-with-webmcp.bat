@echo off
REM ============================================
REM Awareness Market - WebMCP 快速启动脚本
REM ============================================

echo.
echo ========================================
echo  Awareness Market with WebMCP
echo ========================================
echo.

REM 检查 Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js 未安装
    echo 请访问: https://nodejs.org/
    pause
    exit /b 1
)
echo [OK] Node.js 已安装

REM 检查 pnpm
where pnpm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [WARN] pnpm 未安装，正在安装...
    npm install -g pnpm
)
echo [OK] pnpm 已安装

REM 检查 .env 文件
if not exist .env (
    echo [WARN] .env 文件不存在，正在复制...
    copy .env.example .env
    echo [INFO] 请编辑 .env 文件配置必要的环境变量
)
echo [OK] .env 文件存在

REM 检查 JWT_SECRET
findstr /C:"JWT_SECRET=CHANGE_ME" .env >nul
if %ERRORLEVEL% EQU 0 (
    echo [WARN] JWT_SECRET 需要更新
    echo [INFO] 建议运行: openssl rand -base64 64
)

REM 安装依赖
echo.
echo [1/3] 安装依赖...
call pnpm install --silent

REM 启动服务器
echo.
echo [2/3] 启动服务器...
echo.
echo ========================================
echo  服务器启动中...
echo ========================================
echo  前端: http://localhost:5173
echo  后端: http://localhost:5000
echo  Demo: http://localhost:5173/webmcp-demo.html
echo ========================================
echo.
echo [3/3] 按 Ctrl+C 停止服务器
echo.

REM 启动开发服务器
call pnpm run dev

pause
