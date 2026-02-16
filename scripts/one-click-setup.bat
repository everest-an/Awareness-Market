@echo off
REM ============================================================================
REM 一键部署脚本 (Windows)
REM 自动配置自部署 LLM 集成
REM ============================================================================

setlocal enabledelayedexpansion

echo.
echo ======================================
echo   自部署 LLM 一键配置
echo ======================================
echo.

REM 颜色定义 (Windows 10+)
set "INFO=[INFO]"
set "SUCCESS=[SUCCESS]"
set "ERROR=[ERROR]"
set "WARNING=[WARNING]"

REM 检查 Node.js
echo %INFO% 检查 Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo %ERROR% Node.js 未安装
    echo 请访问 https://nodejs.org/ 下载安装
    pause
    exit /b 1
)
echo %SUCCESS% Node.js 已安装

REM 检查项目目录
cd /d "%~dp0.."
if not exist "package.json" (
    echo %ERROR% 未找到 package.json，请确保在正确的目录
    pause
    exit /b 1
)
echo %SUCCESS% 项目目录确认

REM 检查依赖
echo.
echo %INFO% 检查项目依赖...
if not exist "node_modules" (
    echo %WARNING% 依赖未安装，正在安装...
    call npm install
    if errorlevel 1 (
        echo %ERROR% 依赖安装失败
        pause
        exit /b 1
    )
)
echo %SUCCESS% 依赖已安装

REM 交互式配置
echo.
echo ======================================
echo   配置信息收集
echo ======================================
echo.

REM vLLM 服务器地址
set /p VLLM_URL="请输入 vLLM 服务器地址 (例: https://your-pod-id-8000.proxy.runpod.net): "
if "%VLLM_URL%"=="" (
    set "VLLM_URL=http://localhost:8000"
    echo %WARNING% 使用默认地址: %VLLM_URL%
)

REM 模型名称
set /p MODEL_NAME="请输入模型名称 (默认: llama-3.1-8b): "
if "%MODEL_NAME%"=="" set "MODEL_NAME=llama-3.1-8b"

REM RunPod 配置
echo.
echo %INFO% RunPod 配置 (可选，用于自动启停)
set /p RUNPOD_KEY="请输入 RunPod API Key (留空跳过): "
if not "%RUNPOD_KEY%"=="" (
    set /p RUNPOD_ID="请输入 RunPod Pod ID: "
)

REM 成本追踪
echo.
echo %INFO% 成本追踪配置
echo 选项:
echo   1. runpod-rtx-4090-spot (推荐, $0.34/hr)
echo   2. runpod-rtx-4090 ($0.44/hr)
echo   3. runpod-a100 ($1.89/hr)
echo   4. vast-ai-rtx-4090 ($0.29/hr)
echo   5. aws-g5-xlarge ($1.01/hr)
set /p COST_CHOICE="选择成本追踪提供商 (1-5, 默认: 1): "

if "%COST_CHOICE%"=="2" (
    set "COST_PROVIDER=runpod-rtx-4090"
) else if "%COST_CHOICE%"=="3" (
    set "COST_PROVIDER=runpod-a100"
) else if "%COST_CHOICE%"=="4" (
    set "COST_PROVIDER=vast-ai-rtx-4090"
) else if "%COST_CHOICE%"=="5" (
    set "COST_PROVIDER=aws-g5-xlarge"
) else (
    set "COST_PROVIDER=runpod-rtx-4090-spot"
)

REM 创建或更新 .env 文件
echo.
echo %INFO% 更新 .env 文件...

if not exist ".env" (
    echo %INFO% 复制 .env.example...
    copy ".env.example" ".env" >nul
)

REM 使用 PowerShell 更新 .env 文件
powershell -Command ^
"$env_file = '.env'; ^
$content = Get-Content $env_file; ^
$content = $content -replace '^USE_SELF_HOSTED_LLM=.*', 'USE_SELF_HOSTED_LLM=true'; ^
$content = $content -replace '^VLLM_BASE_URL=.*', 'VLLM_BASE_URL=%VLLM_URL%'; ^
$content = $content -replace '^VLLM_MODEL_NAME=.*', 'VLLM_MODEL_NAME=%MODEL_NAME%'; ^
$content = $content -replace '^LLM_COST_PROVIDER=.*', 'LLM_COST_PROVIDER=%COST_PROVIDER%'; ^
if ('%RUNPOD_KEY%' -ne '') { ^
    $content = $content -replace '^# *RUNPOD_API_KEY=.*', 'RUNPOD_API_KEY=%RUNPOD_KEY%'; ^
    $content = $content -replace '^# *RUNPOD_POD_ID=.*', 'RUNPOD_POD_ID=%RUNPOD_ID%'; ^
}; ^
Set-Content -Path $env_file -Value $content"

echo %SUCCESS% .env 文件已更新

REM 显示配置摘要
echo.
echo ======================================
echo   配置摘要
echo ======================================
echo.
echo USE_SELF_HOSTED_LLM: true
echo VLLM_BASE_URL: %VLLM_URL%
echo VLLM_MODEL_NAME: %MODEL_NAME%
echo LLM_COST_PROVIDER: %COST_PROVIDER%
if not "%RUNPOD_KEY%"=="" (
    echo RUNPOD_API_KEY: ****
    echo RUNPOD_POD_ID: %RUNPOD_ID%
)

REM 询问是否启动服务器
echo.
set /p START_SERVER="是否立即启动开发服务器？(Y/N): "
if /i "%START_SERVER%"=="Y" (
    echo.
    echo %INFO% 启动开发服务器...
    echo %INFO% 按 Ctrl+C 停止服务器
    echo.
    call npm run dev
) else (
    echo.
    echo %INFO% 下一步:
    echo   1. 启动开发服务器: npm run dev
    echo   2. 测试集成: bash scripts/test-integration.sh
    echo   3. 访问: http://localhost:3000
    echo.
    echo %SUCCESS% 配置完成！
)

pause
