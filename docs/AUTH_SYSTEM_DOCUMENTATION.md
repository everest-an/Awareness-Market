# Authentication System Documentation

## Overview

The Awareness Network uses a JWT-based authentication system with httpOnly cookies for secure session management.

## Features

- Email/Password authentication
- Email verification (6-digit code)
- OAuth login (GitHub, Google)
- Password strength validation
- Login rate limiting (brute force protection)
- JWT token refresh
- Password reset via email

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   AuthPage.tsx  │────▶│  TRPC Router    │────▶│ auth-standalone │
│   (Frontend)    │     │  (API Layer)    │     │   (Backend)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                      │                       │
         │                      ▼                       ▼
         │              ┌─────────────────┐     ┌─────────────────┐
         │              │  auth-oauth.ts  │     │    Database     │
         │              │  (OAuth Flow)   │     │   (users table) │
         │              └─────────────────┘     └─────────────────┘
         │                      │
         ▼                      ▼
┌─────────────────┐     ┌─────────────────┐
│  useAuth Hook   │     │ auth-rate-limit │
│  (State Mgmt)   │     │ (Brute Force)   │
└─────────────────┘     └─────────────────┘
```

## Components

### Frontend

| File | Purpose |
|------|---------|
| `client/src/pages/AuthPage.tsx` | Login/Register UI with OAuth |
| `client/src/pages/OAuthCallback.tsx` | OAuth callback handler |
| `client/src/pages/EmailVerification.tsx` | Email verification UI |
| `client/src/hooks/useAuth.ts` | Authentication state hook |
| `client/src/components/ForgotPasswordDialog.tsx` | Password reset UI |

### Backend

| File | Purpose |
|------|---------|
| `server/auth-standalone.ts` | Core auth logic (JWT, bcrypt) |
| `server/auth-oauth.ts` | OAuth provider integration |
| `server/auth-rate-limiter.ts` | Login attempt rate limiting |
| `server/auth-password-validator.ts` | Password strength validation |
| `server/auth-email-verification.ts` | Email verification flow |
| `server/routers.ts` | TRPC auth router endpoints |
| `server/_core/cookies.ts` | Cookie configuration |

## Authentication Flow

### Login Flow

```
1. User submits email/password
2. Frontend calls trpc.auth.loginEmail.mutate()
3. Server validates credentials in auth-standalone.ts
4. Server generates JWT access token (7 days) and refresh token (30 days)
5. Server sets httpOnly cookies: jwt_token, jwt_refresh
6. Frontend receives success response
7. Frontend invalidates auth.me query cache
8. Frontend redirects to home page
9. Subsequent requests include cookies automatically
```

### Session Validation Flow

```
1. Request arrives at server
2. context.ts calls sdk.authenticateRequest()
3. sdk.ts extracts jwt_token from cookies
4. auth-standalone.ts verifies JWT signature
5. User object returned and attached to TRPC context
6. Protected procedures can access ctx.user
```

## Cookie Configuration

### Local Development (HTTP)
```javascript
{
  httpOnly: true,
  path: "/",
  sameSite: "lax",
  secure: false,
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
}
```

### Production (HTTPS)
```javascript
{
  httpOnly: true,
  path: "/",
  sameSite: "none",
  secure: true,
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
}
```

## JWT Token Structure

```typescript
interface JWTPayload {
  userId: number;
  email: string;
  role: string;
  type: "access" | "refresh";
}
```

## API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `auth.me` | Query | Public | Get current user |
| `auth.loginEmail` | Mutation | Public | Email/password login |
| `auth.registerEmail` | Mutation | Public | Create new account |
| `auth.logout` | Mutation | Public | Clear session |
| `auth.requestPasswordReset` | Mutation | Public | Send reset code |
| `auth.verifyResetCode` | Mutation | Public | Verify reset code |
| `auth.resetPassword` | Mutation | Public | Set new password |
| `auth.validatePassword` | Query | Public | Check password strength |
| `auth.oauthStatus` | Query | Public | Get OAuth provider status |
| `auth.oauthAuthorizeUrl` | Query | Public | Get OAuth redirect URL |
| `auth.oauthCallback` | Mutation | Public | Handle OAuth callback |
| `auth.refreshToken` | Mutation | Public | Refresh access token |
| `auth.sendVerificationEmail` | Mutation | Protected | Resend verification email |
| `auth.verifyEmail` | Mutation | Public | Verify email with code |
| `auth.verificationStatus` | Query | Public | Check verification status |

## Email Verification

After registration, users receive a 6-digit verification code via email:

1. User registers with email/password
2. System sends verification email with code
3. User is redirected to `/auth/verify?email=...`
4. User enters 6-digit code
5. Account is marked as verified

### Configuration

```env
RESEND_API_KEY=re_your-resend-api-key
EMAIL_FROM=noreply@yourdomain.com
```

### Verification Code Details

- **Code format**: 6 digits (e.g., 123456)
- **Expiration**: 24 hours
- **Max attempts**: 5 per code
- **Resend cooldown**: 60 seconds

## OAuth Setup

### GitHub OAuth

1. Go to https://github.com/settings/developers
2. Click "New OAuth App"
3. Set Authorization callback URL to: `{YOUR_DOMAIN}/api/auth/callback/github`
4. Copy Client ID and Client Secret to `.env`:

```env
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
```

### Google OAuth

1. Go to https://console.cloud.google.com/apis/credentials
2. Create OAuth 2.0 Client ID (Web application)
3. Add Authorized redirect URI: `{YOUR_DOMAIN}/api/auth/callback/google`
4. Copy Client ID and Client Secret to `.env`:

```env
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
```

## Rate Limiting

Login attempts are rate-limited to prevent brute force attacks:

- **Max attempts**: 5 per 15-minute window
- **Lockout duration**: 15 minutes (doubles with each lockout)
- **Max lockout**: 24 hours
- **Tracked by**: IP address and email
- **Storage**: In-memory (development) or Redis (production)

### Redis Configuration (Production)

For distributed deployments, configure Redis for rate limiting:

```env
REDIS_URL=redis://localhost:6379
```

Without Redis, rate limiting uses in-memory storage (suitable for single-instance deployments).

After 5 failed attempts, the user sees a message like:
> "Too many login attempts. Try again in 15 minutes."

## Password Requirements

Passwords are validated for strength:

- Minimum 8 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one number (0-9)
- Special characters recommended (!@#$%^&*)
- Cannot be a common password (e.g., "password123")
- Cannot contain parts of email address

## Security Considerations

1. **httpOnly Cookies**: Tokens not accessible via JavaScript (XSS protection)
2. **Secure Flag**: Cookies only sent over HTTPS in production
3. **SameSite**: Prevents CSRF attacks
4. **Password Hashing**: bcrypt with salt rounds = 10
5. **JWT Expiration**: Access tokens expire in 7 days
6. **Refresh Tokens**: 30-day expiration for session renewal

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| "Invalid email or password" | Wrong credentials | Check email/password |
| "Email already registered" | Duplicate registration | Use login instead |
| "Invalid or expired code" | Password reset code issue | Request new code |
| "UNAUTHORIZED" | Missing/invalid token | Re-login required |

## Environment Variables

```env
# Required
JWT_SECRET=your-secret-key-change-in-production

# Email Service (Resend)
RESEND_API_KEY=re_your-resend-api-key
EMAIL_FROM=noreply@yourdomain.com

# OAuth (Optional)
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
OAUTH_CALLBACK_URL=https://yourdomain.com

# Redis (Optional, for production rate limiting)
REDIS_URL=redis://localhost:6379
```

## Testing Authentication

### Manual Testing
1. Open browser DevTools → Application → Cookies
2. After login, verify `jwt_token` cookie exists
3. Check cookie attributes (httpOnly, path, sameSite)

### API Testing
```bash
# Login
curl -X POST http://localhost:3000/api/trpc/auth.loginEmail \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' \
  -c cookies.txt

# Check session
curl http://localhost:3000/api/trpc/auth.me \
  -b cookies.txt
```

## Troubleshooting

### "Flash logout" after login
- **Cause**: Cookie not being set properly
- **Fix**: Check sameSite/secure settings match environment

### Cookie not sent with requests
- **Cause**: CORS or credentials issue
- **Fix**: Ensure `credentials: "include"` in fetch config

### JWT verification fails
- **Cause**: JWT_SECRET mismatch between instances
- **Fix**: Ensure consistent JWT_SECRET across all servers

---

*Last updated: January 2026*
