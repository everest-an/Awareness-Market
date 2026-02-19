# OAuth Configuration Verification Script (Windows)
# This script verifies that all OAuth settings are correct for production

Write-Host "🔍 OAuth Configuration Verification" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Check 1: Local .env file
Write-Host "1. Checking local .env configuration..." -ForegroundColor Blue
if (Test-Path ".env") {
  $envContent = Get-Content ".env"
  
  $oauthUrl = ($envContent | Select-String "^OAUTH_CALLBACK_URL=" | ForEach-Object { $_.Line.Split('=')[1] }) -join ''
  $googleId = ($envContent | Select-String "^GOOGLE_CLIENT_ID=" | ForEach-Object { $_.Line.Split('=')[1] }) -join ''
  $githubId = ($envContent | Select-String "^GITHUB_CLIENT_ID=" | ForEach-Object { $_.Line.Split('=')[1] }) -join ''
  
  if ([string]::IsNullOrEmpty($oauthUrl)) {
    Write-Host "⚠️  OAUTH_CALLBACK_URL not set in .env" -ForegroundColor Yellow
  } else {
    Write-Host "✓ OAUTH_CALLBACK_URL=$oauthUrl" -ForegroundColor Green
  }
  
  if ([string]::IsNullOrEmpty($googleId)) {
    Write-Host "⚠️  GOOGLE_CLIENT_ID not set in .env" -ForegroundColor Yellow
  } else {
    Write-Host "✓ GOOGLE_CLIENT_ID is set" -ForegroundColor Green
  }
  
  if ([string]::IsNullOrEmpty($githubId)) {
    Write-Host "⚠️  GITHUB_CLIENT_ID not set in .env" -ForegroundColor Yellow
  } else {
    Write-Host "✓ GITHUB_CLIENT_ID is set" -ForegroundColor Green
  }
} else {
  Write-Host "✗ .env file not found" -ForegroundColor Red
}
Write-Host ""

# Check 2: Server code
Write-Host "2. Checking server OAuth route configuration..." -ForegroundColor Blue
$oauthFile = Get-Content "server\_core\oauth.ts" -Raw
if ($oauthFile -match 'app\.get\("/api/auth/callback/:provider"') {
  Write-Host "✓ OAuth route handler is configured correctly" -ForegroundColor Green
} else {
  Write-Host "✗ OAuth route handler not found or incorrect" -ForegroundColor Red
  Write-Host "   Expected: app.get(""/api/auth/callback/:provider"", ...)"
}

if ($oauthFile -match "handleOAuthCallback") {
  Write-Host "✓ handleOAuthCallback function is being called" -ForegroundColor Green
} else {
  Write-Host "⚠️  handleOAuthCallback function not found" -ForegroundColor Yellow
}
Write-Host ""

# Check 3: Frontend configuration
Write-Host "3. Checking frontend OAuth integration..." -ForegroundColor Blue
$authPage = Get-Content "client\src\pages\AuthPage.tsx" -Raw
if ($authPage -match "oauthAuthorizeUrl") {
  Write-Host "✓ Frontend OAuth login is configured" -ForegroundColor Green
} else {
  Write-Host "✗ Frontend OAuth login not found" -ForegroundColor Red
}
Write-Host ""

# Check 4: OAuth app configurations
Write-Host "4. OAuth App Configuration URLs" -ForegroundColor Blue
Write-Host "================================" -ForegroundColor Blue
Write-Host "📋 Please verify these settings in respective OAuth apps:"
Write-Host ""
Write-Host "GitHub OAuth App:"
Write-Host "  URL: https://github.com/settings/developers"
Write-Host "  Setting: Authorization callback URL"
Write-Host "  Value: https://api.awareness.market/api/auth/callback/github"
Write-Host ""
Write-Host "Google OAuth App:"
Write-Host "  URL: https://console.cloud.google.com/apis/credentials"
Write-Host "  Setting: Authorized redirect URIs"
Write-Host "  Value: https://api.awareness.market/api/auth/callback/google"
Write-Host ""

# Check 5: Environment variable setup for CI/CD
Write-Host "5. GitHub Actions Environment Setup" -ForegroundColor Blue
Write-Host "=====================================" -ForegroundColor Blue
Write-Host "Verify that 'production-backend' environment has:"
Write-Host "  - OAUTH_CALLBACK_URL = https://api.awareness.market"
Write-Host "  - GOOGLE_CLIENT_ID = [your client id]"
Write-Host "  - GOOGLE_CLIENT_SECRET = [your client secret]"
Write-Host "  - GITHUB_CLIENT_ID = [your client id]"
Write-Host "  - GITHUB_CLIENT_SECRET = [your client secret]"
Write-Host ""
Write-Host "See: https://github.com/everest-an/Awareness-Market/settings/environments"
Write-Host ""

# Summary
Write-Host "Summary" -ForegroundColor Yellow
Write-Host "=======" -ForegroundColor Yellow
Write-Host "✅ Code changes have been applied:"
Write-Host "   - server/_core/oauth.ts: Route fixed to /api/auth/callback/:provider"
Write-Host "   - .env: OAUTH_CALLBACK_URL updated to https://api.awareness.market"
Write-Host ""
Write-Host "⚠️  ACTION REQUIRED:"
Write-Host "   1. Update GitHub OAuth App callback URL"
Write-Host "   2. Update Google OAuth App redirect URI"
Write-Host "   3. Verify EC2 .env has all OAuth secrets"
Write-Host "   4. Restart backend: pm2 restart awareness-api"
Write-Host ""
Write-Host "🧪 Test:"
Write-Host "   1. Go to https://awareness.market"
Write-Host "   2. Click 'Sign in with Google' or 'Sign in with GitHub'"
Write-Host "   3. Approve authorization"
Write-Host "   4. Should redirect to dashboard (no 404 error)"
