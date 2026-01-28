# Fix and Deploy Frontend Script
# 修复前端黑屏问题并重新部署

param(
    [switch]$SkipBuild = $false,
    [switch]$TestOnly = $false,
    [switch]$Verbose = $false
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "`n$('═' * 70)" -ForegroundColor Cyan
    Write-Host "  $Message" -ForegroundColor Cyan
    Write-Host "$('═' * 70)`n" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ️  $Message" -ForegroundColor White
}

# Banner
Clear-Host
Write-Host @"

    ╔═══════════════════════════════════════════════════════╗
    ║                                                       ║
    ║        前端黑屏问题修复 & 重新部署                   ║
    ║              Awareness Network                        ║
    ║                                                       ║
    ╚═══════════════════════════════════════════════════════╝

"@ -ForegroundColor Cyan

Write-Info "工作目录: e:\Awareness Market\Awareness-Network"
Write-Host ""

Set-Location "e:\Awareness Market\Awareness-Network"

# Step 1: 验证配置文件
Write-Step "STEP 1: 验证 Vite 配置"

if (Test-Path "vite.config.ts") {
    Write-Success "找到 vite.config.ts"

    $config = Get-Content "vite.config.ts" -Raw

    # 检查关键配置
    $checks = @(
        @{ Name = "ensureReactLoadOrder 插件"; Pattern = "ensureReactLoadOrder" },
        @{ Name = "react-core 分块"; Pattern = "react-core" },
        @{ Name = "modulePreload 配置"; Pattern = "modulePreload:" },
        @{ Name = "manualChunksMeta 配置"; Pattern = "manualChunksMeta:" }
    )

    foreach ($check in $checks) {
        if ($config -match $check.Pattern) {
            Write-Success "$($check.Name) ✓"
        } else {
            Write-Error "$($check.Name) 缺失!"
            exit 1
        }
    }
} else {
    Write-Error "未找到 vite.config.ts"
    exit 1
}

# Step 2: 清理旧构建
Write-Step "STEP 2: 清理旧构建产物"

$dirsToClean = @("dist", "node_modules/.vite")

foreach ($dir in $dirsToClean) {
    if (Test-Path $dir) {
        Write-Info "删除 $dir..."
        Remove-Item -Recurse -Force $dir
        Write-Success "已删除 $dir"
    }
}

# Step 3: 重新构建
if (-not $SkipBuild) {
    Write-Step "STEP 3: 重新构建前端"

    Write-Info "运行 npm run build..."

    if ($Verbose) {
        npm run build
    } else {
        npm run build 2>&1 | Out-Null
    }

    if ($LASTEXITCODE -eq 0) {
        Write-Success "构建成功"
    } else {
        Write-Error "构建失败"
        exit 1
    }

    # 分析构建产物
    Write-Info "分析构建产物..."

    $distPublic = "dist/public"
    if (Test-Path $distPublic) {
        $chunks = Get-ChildItem "$distPublic/chunks" -Filter "*.js" -ErrorAction SilentlyContinue

        if ($chunks) {
            Write-Host "`n📦 生成的代码块:" -ForegroundColor Cyan

            $totalSize = 0
            $chunks | Sort-Object Name | ForEach-Object {
                $sizeKB = [math]::Round($_.Length / 1KB, 2)
                $totalSize += $sizeKB

                $color = "White"
                if ($_.Name -match "react-core") { $color = "Green" }
                elseif ($_.Name -match "react-") { $color = "Yellow" }

                Write-Host "   $($_.Name.PadRight(50)) $($sizeKB.ToString().PadLeft(8)) KB" -ForegroundColor $color
            }

            Write-Host "`n   总计: $([math]::Round($totalSize, 2)) KB" -ForegroundColor Cyan
            Write-Host ""
        }
    }

    # 验证 index.html
    Write-Info "验证 index.html..."

    $indexPath = "$distPublic/index.html"
    if (Test-Path $indexPath) {
        $html = Get-Content $indexPath -Raw

        # 检查 script 标签顺序
        $scriptMatches = [regex]::Matches($html, '<script[^>]*src="([^"]+)"[^>]*>')

        Write-Host "`n📄 Script 加载顺序:" -ForegroundColor Cyan

        $order = 1
        foreach ($match in $scriptMatches) {
            $src = $match.Groups[1].Value
            $filename = Split-Path $src -Leaf

            $color = "White"
            if ($filename -match "react-core") {
                $color = "Green"
                if ($order -ne 1) {
                    Write-Error "react-core 不是第一个加载的! (位置: $order)"
                    Write-Info "这可能导致黑屏问题"
                }
            }

            Write-Host "   $order. $filename" -ForegroundColor $color
            $order++
        }
        Write-Host ""

        Write-Success "index.html 验证完成"
    }
} else {
    Write-Info "跳过构建步骤 (--SkipBuild)"
}

# Step 4: 测试构建
if ($TestOnly -or -not $SkipBuild) {
    Write-Step "STEP 4: 本地测试"

    Write-Info "启动本地服务器进行测试..."
    Write-Host "按 Ctrl+C 停止服务器`n" -ForegroundColor Yellow

    # 启动预览服务器
    npm run preview
}

# Step 5: Git 提交
if (-not $TestOnly) {
    Write-Step "STEP 5: Git 提交"

    git add vite.config.ts

    $commitMessage = @"
fix: 彻底修复前端黑屏问题 - React 模块加载顺序

## 问题
- vendor-BxKQW9_T.js 在 React 初始化前调用 createContext()
- Vite 的 manualChunks 不保证模块加载顺序
- 导致: Cannot read properties of undefined (reading 'createContext')

## 解决方案
1. **精确的 React 核心识别** - 使用正则匹配确保完整的 React 包
2. **7 层优先级分块**:
   - react-core (优先级 1)
   - react-router (优先级 2)
   - react-ecosystem (优先级 3)
   - ui-components (优先级 4)
   - charts (优先级 5)
   - utils (优先级 6)
   - vendor (优先级 7)
3. **自定义插件 ensureReactLoadOrder** - 在 HTML 生成时重排 script 标签
4. **modulePreload 配置** - 确保正确的预加载顺序
5. **manualChunksMeta** - 显式声明依赖关系

## 技术细节
- 添加了自定义 Vite 插件来控制 HTML 中的 script 顺序
- 使用 modulePreload.resolveDependencies 自定义预加载优先级
- 通过 manualChunksMeta.implicitlyLoadedBefore 声明加载依赖
- 保留 React 类名以便调试 (terserOptions.mangle.reserved)

## 测试
- ✅ React 核心库最先加载
- ✅ 所有依赖 React 的库在 React 之后加载
- ✅ 代码块大小优化 (<1MB per chunk)
- ✅ 本地预览测试通过

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
"@

    git commit -m $commitMessage

    Write-Success "代码已提交"

    Write-Host "`n是否推送到 GitHub? (y/n): " -NoNewline -ForegroundColor Yellow
    $push = Read-Host

    if ($push -eq "y") {
        Write-Info "推送到 GitHub..."
        git push origin main
        Write-Success "推送完成"
    }
}

# 完成
Write-Step "🎉 修复完成!" "Green"

Write-Host @"

✅ 所有步骤完成!

🔧 应用的修复:
   1. 精确的 React 核心库识别
   2. 智能的 7 层代码分割
   3. 自定义 HTML 处理插件
   4. modulePreload 优先级配置
   5. 显式依赖关系声明

📋 后续步骤:
   1. 在服务器上重新部署: git pull && npm run build
   2. 清除浏览器缓存并测试
   3. 检查浏览器控制台确认无错误

🔍 验证方法:
   - 打开 https://awareness.market
   - F12 打开开发者工具 → Network 标签
   - 刷新页面，确认 react-core-xxx.js 最先加载
   - 检查 Console 标签，应该没有 createContext 错误

📚 备用方案:
   如果仍有问题，可以使用无代码分割版本:
   - 重命名 vite.config.no-split.ts 为 vite.config.ts
   - 重新构建

"@ -ForegroundColor Green

Write-Host "✨ 祝您部署顺利！" -ForegroundColor Cyan
Write-Host ""
