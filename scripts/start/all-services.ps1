#!/usr/bin/env pwsh

# 启动所有服务的脚本
# 包括 Go 微服务和 Node.js API 网关

Write-Host "🚀 启动 Awareness Market 完整栈..." -ForegroundColor Cyan
Write-Host ""

# 项目根目录
$rootDir = Get-Location
$goServicesDir = Join-Path $rootDir "go-services"

# 启动 Go 服务的函数
function Start-GoService {
    param(
        [string]$serviceName,
        [string]$serviceDir,
        [int]$port
    )
    
    Write-Host "启动 $serviceName 服务 (端口 $port)..." -ForegroundColor Yellow
    
    # 在新的 PowerShell 窗口中启动每个服务
    Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd '$serviceDir'; go run main.go" -WindowStyle Normal
    
    Start-Sleep -Seconds 2
}

# 启动所有 Go 微服务
Write-Host ""
Write-Host "=== 启动 Go 微服务 ===" -ForegroundColor Cyan

Start-GoService "Memory Exchange" (Join-Path $goServicesDir "memory-exchange") 8080
Start-GoService "W-Matrix Marketplace" (Join-Path $goServicesDir "w-matrix-marketplace") 8081
Start-GoService "Vector Operations" (Join-Path $goServicesDir "vector-operations") 8083

Write-Host ""
Write-Host "=== 启动 Node.js API Gateway ===" -ForegroundColor Cyan
Write-Host "启动 Node.js 开发服务器..." -ForegroundColor Yellow

# 在新窗口中启动 Node.js 服务
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd '$rootDir'; pnpm dev" -WindowStyle Normal

Write-Host ""
Write-Host "✅ 所有服务启动中..." -ForegroundColor Green
Write-Host ""
Write-Host "服务地址:" -ForegroundColor Cyan
Write-Host "  API Gateway: http://localhost:3001" -ForegroundColor Yellow
Write-Host "  Memory Service: http://localhost:8080" -ForegroundColor Yellow
Write-Host "  Marketplace Service: http://localhost:8081" -ForegroundColor Yellow
Write-Host "  Vector Service: http://localhost:8083" -ForegroundColor Yellow
Write-Host ""
Write-Host "运行集成测试: node test-integration.mjs" -ForegroundColor Cyan
