# Awareness Market - Windows 自动安装脚本
# 自动安装 PostgreSQL + Docker + 部署 pgvector + Infinity Server

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Awareness Market 自动部署脚本" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# 检查管理员权限
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "❌ 需要管理员权限运行此脚本" -ForegroundColor Red
    Write-Host "请右键点击 PowerShell，选择'以管理员身份运行'" -ForegroundColor Yellow
    pause
    exit 1
}

Write-Host "✅ 管理员权限确认" -ForegroundColor Green
Write-Host ""

# 1. 安装 Chocolatey（Windows 包管理器）
Write-Host "📦 Step 1: 检查 Chocolatey..." -ForegroundColor Cyan
if (!(Get-Command choco -ErrorAction SilentlyContinue)) {
    Write-Host "  正在安装 Chocolatey..." -ForegroundColor Yellow
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

    # 刷新环境变量
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

    Write-Host "  ✅ Chocolatey 安装完成" -ForegroundColor Green
} else {
    Write-Host "  ✅ Chocolatey 已安装" -ForegroundColor Green
}
Write-Host ""

# 2. 安装 PostgreSQL
Write-Host "🗄️  Step 2: 检查 PostgreSQL..." -ForegroundColor Cyan
if (!(Get-Command psql -ErrorAction SilentlyContinue)) {
    Write-Host "  正在安装 PostgreSQL 15..." -ForegroundColor Yellow
    Write-Host "  这可能需要 5-10 分钟，请耐心等待..." -ForegroundColor Yellow

    choco install postgresql15 --params '/Password:postgres123' -y

    # 刷新环境变量
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

    Write-Host "  ✅ PostgreSQL 安装完成" -ForegroundColor Green
    Write-Host "  默认密码: postgres123" -ForegroundColor Yellow
} else {
    Write-Host "  ✅ PostgreSQL 已安装" -ForegroundColor Green
}
Write-Host ""

# 3. 安装 Docker Desktop
Write-Host "🐳 Step 3: 检查 Docker..." -ForegroundColor Cyan
if (!(Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "  正在安装 Docker Desktop..." -ForegroundColor Yellow
    Write-Host "  这可能需要 10-15 分钟，请耐心等待..." -ForegroundColor Yellow

    choco install docker-desktop -y

    Write-Host "  ✅ Docker Desktop 安装完成" -ForegroundColor Green
    Write-Host "  ⚠️  需要重启计算机后才能使用 Docker" -ForegroundColor Yellow

    $restart = Read-Host "是否现在重启计算机？(Y/N)"
    if ($restart -eq "Y" -or $restart -eq "y") {
        Write-Host "正在重启..." -ForegroundColor Yellow
        Restart-Computer
        exit
    }
} else {
    Write-Host "  ✅ Docker 已安装" -ForegroundColor Green
}
Write-Host ""

# 4. 创建数据库
Write-Host "🗄️  Step 4: 创建数据库..." -ForegroundColor Cyan
try {
    $env:PGPASSWORD = "postgres123"

    # 检查数据库是否存在
    $dbExists = & psql -U postgres -lqt | Select-String -Pattern "awareness_market_dev"

    if (-not $dbExists) {
        Write-Host "  正在创建数据库 awareness_market_dev..." -ForegroundColor Yellow
        & psql -U postgres -c "CREATE DATABASE awareness_market_dev;"
        Write-Host "  ✅ 数据库创建完成" -ForegroundColor Green
    } else {
        Write-Host "  ✅ 数据库已存在" -ForegroundColor Green
    }
} catch {
    Write-Host "  ⚠️  数据库创建失败: $_" -ForegroundColor Yellow
    Write-Host "  您可以稍后手动创建" -ForegroundColor Yellow
}
Write-Host ""

# 5. 安装 pgvector 扩展
Write-Host "📊 Step 5: 安装 pgvector 扩展..." -ForegroundColor Cyan
try {
    Set-Location "e:\Awareness Market\Awareness-Market - MAIN"

    $env:PGPASSWORD = "postgres123"
    & psql -U postgres -d awareness_market_dev -c "CREATE EXTENSION IF NOT EXISTS vector;"

    Write-Host "  ✅ pgvector 扩展安装完成" -ForegroundColor Green
} catch {
    Write-Host "  ⚠️  pgvector 安装失败: $_" -ForegroundColor Yellow
    Write-Host "  可能需要单独安装 pgvector" -ForegroundColor Yellow
}
Write-Host ""

# 6. 运行数据库迁移
Write-Host "🔄 Step 6: 运行数据库迁移..." -ForegroundColor Cyan
try {
    Set-Location "e:\Awareness Market\Awareness-Market - MAIN"

    $env:PGPASSWORD = "postgres123"
    & psql -U postgres -d awareness_market_dev -f "prisma/migrations/11_add_package_embeddings.sql"

    Write-Host "  ✅ 数据库迁移完成" -ForegroundColor Green
} catch {
    Write-Host "  ⚠️  迁移失败: $_" -ForegroundColor Yellow
}
Write-Host ""

# 7. 更新 .env 文件
Write-Host "⚙️  Step 7: 更新 .env 配置..." -ForegroundColor Cyan
try {
    $envPath = "e:\Awareness Market\Awareness-Market - MAIN\.env"

    if (Test-Path $envPath) {
        $envContent = Get-Content $envPath -Raw
        $envContent = $envContent -replace 'postgresql://postgres:your_password@localhost:5432/awareness_market_dev', 'postgresql://postgres:postgres123@localhost:5432/awareness_market_dev'
        Set-Content -Path $envPath -Value $envContent

        Write-Host "  ✅ .env 配置已更新" -ForegroundColor Green
        Write-Host "  数据库密码: postgres123" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ⚠️  配置更新失败: $_" -ForegroundColor Yellow
}
Write-Host ""

# 8. 部署 Infinity Server
Write-Host "🚀 Step 8: 部署 Infinity Embedding Server..." -ForegroundColor Cyan
try {
    # 检查 Docker 是否运行
    $dockerRunning = docker ps 2>&1

    if ($LASTEXITCODE -eq 0) {
        Write-Host "  正在拉取 Infinity Docker 镜像..." -ForegroundColor Yellow
        docker pull michaelf34/infinity:latest

        Write-Host "  正在启动 Infinity Server..." -ForegroundColor Yellow

        # 停止现有容器
        docker stop infinity-embedding 2>$null
        docker rm infinity-embedding 2>$null

        # 启动新容器
        docker run -d `
            --name infinity-embedding `
            --restart unless-stopped `
            -p 7997:7997 `
            -e MODEL_ID=nomic-ai/nomic-embed-text-v1.5 `
            -e BATCH_SIZE=32 `
            -e ENGINE=torch `
            -v infinity_cache:/app/.cache `
            michaelf34/infinity:latest

        Write-Host "  ✅ Infinity Server 已启动" -ForegroundColor Green
        Write-Host "  正在等待模型加载（约 3-5 分钟）..." -ForegroundColor Yellow

        # 等待服务就绪
        $maxRetries = 60
        $retries = 0
        while ($retries -lt $maxRetries) {
            try {
                $response = Invoke-WebRequest -Uri "http://localhost:7997/health" -TimeoutSec 5 -ErrorAction SilentlyContinue
                if ($response.StatusCode -eq 200) {
                    Write-Host "  ✅ Infinity Server 已就绪！" -ForegroundColor Green
                    break
                }
            } catch {
                # 继续等待
            }

            $retries++
            Write-Host "  等待中... ($retries/$maxRetries)" -ForegroundColor Gray
            Start-Sleep -Seconds 5
        }

        if ($retries -eq $maxRetries) {
            Write-Host "  ⚠️  服务启动超时，请检查日志: docker logs infinity-embedding" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ⚠️  Docker 未运行，请启动 Docker Desktop" -ForegroundColor Yellow
        Write-Host "  启动后重新运行此脚本" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ⚠️  Infinity 部署失败: $_" -ForegroundColor Yellow
}
Write-Host ""

# 完成
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "🎉 部署完成！" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 部署信息:" -ForegroundColor Cyan
Write-Host "  - 数据库: postgresql://postgres:postgres123@localhost:5432/awareness_market_dev" -ForegroundColor White
Write-Host "  - Infinity Server: http://localhost:7997" -ForegroundColor White
Write-Host ""
Write-Host "🧪 验证部署:" -ForegroundColor Cyan
Write-Host "  1. 测试数据库: psql -U postgres -d awareness_market_dev -c 'SELECT extname FROM pg_extension WHERE extname = ''vector'';'" -ForegroundColor Gray
Write-Host "  2. 测试 Infinity: curl http://localhost:7997/health" -ForegroundColor Gray
Write-Host ""
Write-Host "📖 下一步:" -ForegroundColor Cyan
Write-Host "  - 查看完整文档: DEPLOYMENT_GUIDE.md" -ForegroundColor Gray
Write-Host "  - 运行回填脚本: npm run backfill-embeddings" -ForegroundColor Gray
Write-Host ""

pause
