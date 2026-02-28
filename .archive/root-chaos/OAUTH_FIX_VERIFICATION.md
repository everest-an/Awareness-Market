# OAuth Callback Fix Verification Checklist

## Problem
User clicked Google login → "Cannot GET /api/auth/callback/google" (404 error)

## Root Causes Identified
1. ✅ **FIXED**: Express route was generic `/api/oauth/callback` instead of provider-specific `/api/auth/callback/:provider`
2. ✅ **FIXED**: `.env` had old `OAUTH_CALLBACK_URL=http://localhost:3000` instead of `https://api.awareness.market`
3. 🔍 **NEED TO VERIFY**: GitHub/Google OAuth app configuration has correct callback URLs

## Changes Made

### 1. Fixed `server/_core/oauth.ts` 
- Changed route from: `app.get("/api/oauth/callback", ...)`  
- Changed route to: `app.get("/api/auth/callback/:provider", ...)`
- Now correctly routes `/api/auth/callback/google` and `/api/auth/callback/github`
- Calls `handleOAuthCallback()` from `auth-oauth.ts` for proper Google/GitHub handling

### 2. Updated `.env`
- Changed: `OAUTH_CALLBACK_URL=http://localhost:3000`
- Changed to: `OAUTH_CALLBACK_URL=https://api.awareness.market`

### 3. Verified EC2 Environment 
- EC2 backup already had: `OAUTH_CALLBACK_URL=https://api.awareness.market` ✅

### 4. Architecture Flow
```
Frontend (awareness.market)
  ↓ [User clicks "Sign in with Google"]
  ↓ Fetches OAuth URL from server: /auth.oauthAuthorizeUrl.useQuery({ provider: "google" })
  ↓ Server (api.awareness.market) generates URL using OAUTH_CALLBACK_URL env var
  ↓ URL = `https://accounts.google.com/o/oauth2/v2/auth?redirect_uri=https://api.awareness.market/api/auth/callback/google&...`
  ↓ Redirects to Google login
  ↓ User approves → Google redirects to: https://api.awareness.market/api/auth/callback/google?code=...&state=...
  ↓ Express route /api/auth/callback/:provider catches this
  ↓ Calls handleOAuthCallback(provider="google", code=...)
  ↓ Returns user + tokens
  ↓ Redirects to frontend dashboard
```

## Next Steps to Verify

### Step 1: Check GitHub OAuth App Settings
Go to: https://github.com/settings/developers
- Find the OAuth app for "Awareness Market"
- Verify "Authorization callback URL" = `https://api.awareness.market/api/auth/callback/github`
- **If incorrect:** Update to `https://api.awareness.market/api/auth/callback/github`

### Step 2: Check Google OAuth App Settings
Go to: https://console.cloud.google.com/apis/credentials
- Find OAuth 2.0 Client ID for Awareness Market
- Verify "Authorized redirect URIs" includes: `https://api.awareness.market/api/auth/callback/google`
- **If incorrect:** Add/update to `https://api.awareness.market/api/auth/callback/google`

### Step 3: Verify Environment Variables on EC2
SSH to EC2 and check:
```bash
grep GOOGLE_CLIENT_ID ~/.env
grep GITHUB_CLIENT_ID ~/.env
grep OAUTH_CALLBACK_URL ~/.env
```

Should output:
```
OAUTH_CALLBACK_URL=https://api.awareness.market
GOOGLE_CLIENT_ID=<value>
GITHUB_CLIENT_ID=<value>
```

### Step 4: Restart Backend Services
After OAuth app configs are updated:
```bash
# On EC2
pm2 restart all
# or
pm2 restart awareness-api
```

### Step 5: Test OAuth Flow
1. Open https://awareness.market
2. Click "Sign in with Google" (or GitHub)
3. Approve authorization
4. Should redirect to dashboard (not 404)

## Files Modified
- [server/_core/oauth.ts](../server/_core/oauth.ts) - Route definition
- [.env](../.env) - OAUTH_CALLBACK_URL environment variable

## Related Files (Reference)
- `server/auth-oauth.ts` - OAuth logic (Google/GitHub handlers)
- `server/routers.ts` - tRPC OAuth endpoints
- `client/src/pages/OAuthCallback.tsx` - Frontend callback handler
- `client/src/pages/AuthPage.tsx` - Login button implementation

## Status
🟡 **PARTIALLY FIXED** - Code changes applied, but OAuth app configurations need verification
