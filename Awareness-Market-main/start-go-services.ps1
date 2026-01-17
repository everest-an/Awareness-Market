# Awareness Market Go 微服务启动脚本 (Windows)

Write-Host "========================================" -ForegroundColor Blue
Write-Host "🚀 Awareness Market Go 微服务启动器" -ForegroundColor Blue
Write-Host "========================================" -ForegroundColor Blue

# 检查 Go 是否安装
try {
    $goVersion = & go version
    Write-Host "✓ Go 已安装: $goVersion" -ForegroundColor Green
}
catch {
    Write-Host "❌ Go 未安装。请先安装 Go 1.21+" -ForegroundColor Yellow
    exit 1
}

# 定义服务配置
$services = @{
    "vector-operations" = 8083
    "memory-exchange" = 8080
    "w-matrix-marketplace" = 8081
}

# 检查端口是否占用
function Check-Port {
    param([int]$Port)
    $netstat = netstat -ano | Select-String ":$Port" 
    return $null -ne $netstat
}

# 获取占用端口的进程并杀死
function Kill-Port {
    param([int]$Port)
    try {
        $process = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
        if ($process) {
            Stop-Process -Id $process.OwningProcess -Force
            Write-Host "⚠️  已杀死占用端口 $Port 的进程" -ForegroundColor Yellow
            Start-Sleep -Seconds 1
        }
    }
    catch {
        # 进程可能已经关闭
    }
}

# 启动单个服务
function Start-Service {
    param(
        [string]$ServiceName,
        [int]$Port
    )

    $serviceDir = "go-services\$ServiceName"
    
    if (-not (Test-Path $serviceDir)) {
        Write-Host "⚠️  目录不存在: $serviceDir" -ForegroundColor Yellow
        return
    }

    if (Check-Port -Port $Port) {
        Write-Host "⚠️  端口 $Port 已被占用 ($ServiceName)" -ForegroundColor Yellow
        Write-Host "⚠️  尝试杀死现有进程..." -ForegroundColor Yellow
        Kill-Port -Port $Port
    }

    Write-Host "启动 $ServiceName (端口 $Port)..." -ForegroundColor Blue
    
    # 在后台启动服务
    Push-Location $serviceDir
    $logFile = "$env:TEMP\${ServiceName}.log"
    
    Start-Process go -ArgumentList "run", "./cmd/main.go" `
        -RedirectStandardOutput $logFile `
        -RedirectStandardError $logFile `
        -WindowStyle Hidden
    
    Pop-Location
    
    # 等待服务启动
    Start-Sleep -Seconds 3
    
    # 检查服务是否响应
    $retries = 0
    while ($retries -lt 5) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:$Port/health" -TimeoutSec 2 -ErrorAction SilentlyContinue
            if ($response -and $response.StatusCode -eq 200) {
                Write-Host "✓ $ServiceName 已启动 (端口 $Port)" -ForegroundColor Green
                return
            }
        }
        catch {
            $retries++
            if ($retries -lt 5) {
                Write-Host "⏳ 等待 $ServiceName 启动... ($retries/5)" -ForegroundColor Yellow
                Start-Sleep -Seconds 1
            }
        }
    }
    
    Write-Host "❌ $ServiceName 启动可能失败，查看日志: $logFile" -ForegroundColor Yellow
}

# 启动所有服务
Write-Host ""
Write-Host "启动所有 Go 微服务..." -ForegroundColor Blue
Write-Host ""

foreach ($service in $services.Keys) {
    $port = $services[$service]
    Start-Service -ServiceName $service -Port $port
}

# 健康检查
Write-Host ""
Write-Host "========================================" -ForegroundColor Blue
Write-Host "执行健康检查..." -ForegroundColor Blue
Write-Host "========================================" -ForegroundColor Blue
Write-Host ""

function Health-Check {
    param(
        [int]$Port,
        [string]$ServiceName
    )
    
    for ($i = 1; $i -le 5; $i++) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:$Port/health" -TimeoutSec 2 -ErrorAction SilentlyContinue
            if ($response -and $response.StatusCode -eq 200) {
                $content = $response.Content | ConvertFrom-Json
                Write-Host "✓ $ServiceName 健康 (状态: $($content.status))" -ForegroundColor Green
                return
            }
        }
        catch {
            Write-Host "⏳ 等待 $ServiceName 启动... ($i/5)" -ForegroundColor Yellow
            Start-Sleep -Seconds 1
        }
    }
    
    Write-Host "⚠️  $ServiceName 未响应（可能还未启动）" -ForegroundColor Yellow
}

Health-Check -Port 8083 -ServiceName "Vector Operations"
Health-Check -Port 8080 -ServiceName "Memory Exchange"
Health-Check -Port 8081 -ServiceName "W-Matrix Marketplace"

Write-Host ""
Write-Host "========================================" -ForegroundColor Blue
Write-Host "✓ Go 微服务启动脚本完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Blue
Write-Host ""
Write-Host "📊 服务访问地址:" -ForegroundColor Blue
Write-Host "  Vector Operations    (Port 8083): http://localhost:8083/health" -ForegroundColor Cyan
Write-Host "  Memory Exchange      (Port 8080): http://localhost:8080/health" -ForegroundColor Cyan
Write-Host "  W-Matrix Marketplace (Port 8081): http://localhost:8081/health" -ForegroundColor Cyan
Write-Host ""
Write-Host "📖 Swagger 文档:" -ForegroundColor Blue
Write-Host "  Memory Exchange: http://localhost:8080/swagger/index.html" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  要停止所有服务，请使用: taskkill /F /IM go.exe" -ForegroundColor Yellow
Write-Host ""
