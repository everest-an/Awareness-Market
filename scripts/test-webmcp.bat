@echo off
REM ============================================
REM WebMCP 配置测试脚本
REM ============================================

echo.
echo ========================================
echo  WebMCP Configuration Test
echo ========================================
echo.

REM 测试 1: 检查环境变量
echo [Test 1] 检查 .env 配置...
if not exist .env (
    echo [FAIL] .env 文件不存在
    exit /b 1
)
echo [PASS] .env 文件存在

REM 测试 2: 检查 JWT_SECRET
echo [Test 2] 检查 JWT_SECRET...
findstr /C:"JWT_SECRET=" .env | findstr /V "CHANGE_ME" >nul
if %ERRORLEVEL% NEQ 0 (
    echo [FAIL] JWT_SECRET 未配置或使用默认值
    echo        请运行: openssl rand -base64 64
    exit /b 1
)
echo [PASS] JWT_SECRET 已配置

REM 测试 3: 检查 WebMCP 文件
echo [Test 3] 检查 WebMCP 文件...
if not exist "client\src\lib\webmcp\webmcp-client.ts" (
    echo [FAIL] WebMCP 客户端文件缺失
    exit /b 1
)
if not exist "client\src\lib\webmcp\webmcp-styles.css" (
    echo [FAIL] WebMCP 样式文件缺失
    exit /b 1
)
echo [PASS] WebMCP 文件完整

REM 测试 4: 检查主应用集成
echo [Test 4] 检查主应用集成...
findstr /C:"initializeWebMCP" "client\src\main.tsx" >nul
if %ERRORLEVEL% NEQ 0 (
    echo [FAIL] WebMCP 未在 main.tsx 中初始化
    exit /b 1
)
echo [PASS] WebMCP 已集成到主应用

REM 测试 5: 检查 MCP Router
echo [Test 5] 检查 MCP Router...
if not exist "server\routers\mcp.ts" (
    echo [FAIL] MCP Router 文件缺失
    exit /b 1
)
findstr /C:"mcp: mcpRouter" "server\routers.ts" >nul
if %ERRORLEVEL% NEQ 0 (
    echo [FAIL] MCP Router 未注册
    exit /b 1
)
echo [PASS] MCP Router 已配置

REM 测试 6: 检查 ERC-8004
echo [Test 6] 检查 ERC-8004 配置...
findstr /C:"ERC8004_REGISTRY_ADDRESS=" .env >nul
if %ERRORLEVEL% NEQ 0 (
    echo [WARN] ERC-8004 未配置（可选）
) else (
    echo [PASS] ERC-8004 已配置
)

echo.
echo ========================================
echo  所有必需测试通过！
echo ========================================
echo.
echo 下一步:
echo   1. 运行: start-with-webmcp.bat
echo   2. 访问: http://localhost:5173
echo   3. 查看右下角的蓝色 WebMCP 按钮
echo.

pause
