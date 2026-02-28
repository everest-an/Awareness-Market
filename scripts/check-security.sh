#!/bin/bash
# 安全检查脚本

echo "🔍 检查API密钥安全性..."
echo ""

# 1. 检查.env是否在.gitignore中
echo "1. 检查 .env 是否被Git忽略："
if git check-ignore .env > /dev/null 2>&1; then
    echo "   ✅ .env 已在 .gitignore 中"
else
    echo "   ❌ 警告：.env 未被忽略！"
fi
echo ""

# 2. 检查.env是否在Git追踪中
echo "2. 检查 .env 是否被Git追踪："
if git ls-files --error-unmatch .env > /dev/null 2>&1; then
    echo "   ❌ 危险：.env 已被Git追踪！"
else
    echo "   ✅ .env 未被Git追踪"
fi
echo ""

# 3. 检查最近的提交中是否包含密钥
echo "3. 检查最近5次提交中是否有API密钥："
if git log -5 --all -S "RESEND_API_KEY" --pretty=format:"%h %s" | grep -v "example\|xxx\|CHANGE_ME" > /dev/null 2>&1; then
    echo "   ⚠️  发现可疑提交"
    git log -5 --all -S "RESEND_API_KEY" --pretty=format:"   %h %s"
else
    echo "   ✅ 未发现密钥泄露"
fi
echo ""

# 4. 检查resend包是否在package.json中
echo "4. 检查 resend npm 包："
if grep -q '"resend"' package.json; then
    VERSION=$(grep '"resend"' package.json | sed 's/.*: "\^\?\([0-9.]*\)".*/\1/')
    echo "   ✅ resend 包已在 package.json (版本: $VERSION)"
else
    echo "   ❌ resend 包未在 package.json 中"
fi
echo ""

# 5. 检查代码中是否有硬编码密钥
echo "5. 扫描代码中的硬编码密钥（排除示例）："
HARDCODED=$(git grep -i "re_[A-Za-z0-9_]\{20,\}" -- "*.ts" "*.js" "*.tsx" "*.jsx" | grep -v "re_CHANGE_ME\|re_xxx\|re_your\|re_123" || true)
if [ -z "$HARDCODED" ]; then
    echo "   ✅ 未发现硬编码密钥"
else
    echo "   ⚠️  发现可疑代码："
    echo "$HARDCODED" | head -3
fi
echo ""

echo "✅ 安全检查完成！"
