# Awareness Market - 启动所有 Go 微服务
# 使用方式: .\start-services.ps1

Write-Host "========================================" -ForegroundColor Blue
Write-Host "🚀 启动 Awareness Market Go 微服务" -ForegroundColor Blue
Write-Host "========================================" -ForegroundColor Blue
Write-Host ""

# 检查 Go 是否安装
$goCheck = go version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Go 未安装或不在 PATH 中" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Go 已安装: $goCheck" -ForegroundColor Green

# 定义服务
$services = @(
    @{ name = "vector-operations"; port = 8083 },
    @{ name = "memory-exchange"; port = 8080 },
    @{ name = "w-matrix-marketplace"; port = 8081 }
)

Write-Host ""
Write-Host "启动 Go 微服务..." -ForegroundColor Blue

foreach ($svc in $services) {
    $svcName = $svc.name
    $port = $svc.port
    $svcPath = "go-services\$svcName"
    
    if (-not (Test-Path $svcPath)) {
        Write-Host "⚠️  跳过 $svcName (目录不存在)" -ForegroundColor Yellow
        continue
    }
    
    Write-Host "启动 $svcName (Port $port)..." -ForegroundColor Cyan
    
    # 杀死占用端口的进程
    $existingProcess = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($existingProcess) {
        Write-Host "  杀死占用端口的进程..." -ForegroundColor Yellow
        Stop-Process -Id $existingProcess.OwningProcess -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1
    }
    
    # 启动服务
    $logPath = "$env:TEMP\${svcName}.log"
    Push-Location $svcPath
    Start-Process go -ArgumentList "run", "./cmd/main.go" -RedirectStandardOutput $logPath -RedirectStandardError $logPath -WindowStyle Hidden
    Pop-Location
    
    Start-Sleep -Seconds 2
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Blue
Write-Host "检查服务健康状态..." -ForegroundColor Blue
Write-Host "========================================" -ForegroundColor Blue
Write-Host ""

$allHealthy = $true

foreach ($svc in $services) {
    $svcName = $svc.name
    $port = $svc.port
    $healthUrl = "http://localhost:$port/health"
    
    $healthy = $false
    for ($i = 0; $i -lt 5; $i++) {
        try {
            $resp = Invoke-WebRequest -Uri $healthUrl -TimeoutSec 2 -ErrorAction SilentlyContinue
            if ($resp.StatusCode -eq 200) {
                Write-Host "✓ $svcName 正常运行 (Port $port)" -ForegroundColor Green
                $healthy = $true
                break
            }
        }
        catch {
            # 重试
        }
        Start-Sleep -Seconds 1
    }
    
    if (-not $healthy) {
        Write-Host "⚠️  $svcName 未响应 (Port $port)" -ForegroundColor Yellow
        $allHealthy = $false
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Blue

if ($allHealthy) {
    Write-Host "✅ 所有服务启动成功！" -ForegroundColor Green
} else {
    Write-Host "⚠️  部分服务启动中，请稍候..." -ForegroundColor Yellow
}

Write-Host "========================================" -ForegroundColor Blue
Write-Host ""
Write-Host "📊 服务地址:" -ForegroundColor Blue
Write-Host "  Vector Operations:    http://localhost:8083/health" -ForegroundColor Cyan
Write-Host "  Memory Exchange:      http://localhost:8080/health" -ForegroundColor Cyan
Write-Host "  W-Matrix Marketplace: http://localhost:8081/health" -ForegroundColor Cyan
Write-Host ""
Write-Host "📖 Swagger 文档: http://localhost:8080/swagger/index.html" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  要停止所有服务: taskkill /F /IM go.exe" -ForegroundColor Yellow
Write-Host ""
