/**
 * OAuth Authentication Module
 * 
 * Supports GitHub and Google OAuth 2.0 authentication flows.
 * 
 * ## Setup Required
 * 
 * ### GitHub OAuth
 * 1. Go to https://github.com/settings/developers
 * 2. Create new OAuth App
 * 3. Set callback URL to: {YOUR_DOMAIN}/api/auth/callback/github
 * 4. Copy Client ID and Client Secret to .env
 * 
 * ### Google OAuth
 * 1. Go to https://console.cloud.google.com/apis/credentials
 * 2. Create OAuth 2.0 Client ID
 * 3. Set callback URL to: {YOUR_DOMAIN}/api/auth/callback/google
 * 4. Copy Client ID and Client Secret to .env
 * 
 * ## Environment Variables
 * ```
 * GITHUB_CLIENT_ID=your_github_client_id
 * GITHUB_CLIENT_SECRET=your_github_client_secret
 * GOOGLE_CLIENT_ID=your_google_client_id
 * GOOGLE_CLIENT_SECRET=your_google_client_secret
 * OAUTH_CALLBACK_URL=http://localhost:3000 (or your production URL)
 * ```
 */

import axios from "axios";
import { findOrCreateOAuthUser } from "./auth-standalone";
import { getErrorMessage } from "./utils/error-handling";
import type { User } from "@prisma/client";
import { createLogger } from './utils/logger';

// User type for API responses (without password)
interface SafeUser {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  avatar: string | null;
  role: string;
  loginMethod: string | null;
  emailVerified: boolean | null;
  lastSignedIn: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const logger = createLogger('OAuth');

// OAuth Configuration
const OAUTH_CONFIG = {
  github: {
    clientId: process.env.GITHUB_CLIENT_ID || "",
    clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
    authorizeUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    userInfoUrl: "https://api.github.com/user",
    userEmailUrl: "https://api.github.com/user/emails",
    scope: "read:user user:email",
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userInfoUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
    scope: "openid email profile",
  },
};

const CALLBACK_BASE_URL = process.env.OAUTH_CALLBACK_URL || "http://localhost:3000";

export type OAuthProvider = "github" | "google";

interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  scope?: string;
  id_token?: string;
}

interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
}

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

interface GoogleUser {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  picture: string;
}

/**
 * Check if OAuth provider is configured
 */
export function isOAuthConfigured(provider: OAuthProvider): boolean {
  const config = OAUTH_CONFIG[provider];
  return Boolean(config.clientId && config.clientSecret);
}

/**
 * Get OAuth configuration status for all providers
 */
export function getOAuthStatus(): Record<OAuthProvider, boolean> {
  return {
    github: isOAuthConfigured("github"),
    google: isOAuthConfigured("google"),
  };
}

/**
 * Generate OAuth authorization URL
 */
export function getOAuthAuthorizeUrl(provider: OAuthProvider, state: string): string {
  const config = OAUTH_CONFIG[provider];
  
  if (!isOAuthConfigured(provider)) {
    throw new Error(`${provider} OAuth is not configured`);
  }

  const callbackUrl = `${CALLBACK_BASE_URL}/api/auth/callback/${provider}`;
  
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: callbackUrl,
    scope: config.scope,
    state,
    response_type: "code",
  });

  // Google requires additional params
  if (provider === "google") {
    params.append("access_type", "offline");
    params.append("prompt", "consent");
  }

  return `${config.authorizeUrl}?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
async function exchangeCodeForToken(
  provider: OAuthProvider,
  code: string
): Promise<OAuthTokenResponse> {
  const config = OAUTH_CONFIG[provider];
  const callbackUrl = `${CALLBACK_BASE_URL}/api/auth/callback/${provider}`;

  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: callbackUrl,
  });

  // GitHub uses different grant_type format
  if (provider === "google") {
    params.append("grant_type", "authorization_code");
  }

  const response = await axios.post<OAuthTokenResponse>(
    config.tokenUrl,
    params.toString(),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
    }
  );

  return response.data;
}

/**
 * Get GitHub user info
 */
async function getGitHubUserInfo(accessToken: string): Promise<{
  providerId: string;
  email: string | null;
  name: string;
  avatar: string;
}> {
  const config = OAUTH_CONFIG.github;

  // Get user profile
  const userResponse = await axios.get<GitHubUser>(config.userInfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  const user = userResponse.data;
  let email = user.email;

  // If email is not public, fetch from emails endpoint
  if (!email) {
    try {
      const emailsResponse = await axios.get<GitHubEmail[]>(config.userEmailUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      });

      const primaryEmail = emailsResponse.data.find(e => e.primary && e.verified);
      email = primaryEmail?.email || emailsResponse.data[0]?.email || null;
    } catch (error) {
      logger.warn('Failed to fetch GitHub emails', { error });
    }
  }

  return {
    providerId: String(user.id),
    email,
    name: user.name || user.login,
    avatar: user.avatar_url,
  };
}

/**
 * Get Google user info
 */
async function getGoogleUserInfo(accessToken: string): Promise<{
  providerId: string;
  email: string | null;
  name: string;
  avatar: string;
}> {
  const config = OAUTH_CONFIG.google;

  const response = await axios.get<GoogleUser>(config.userInfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const user = response.data;

  return {
    providerId: user.id,
    email: user.verified_email ? user.email : null,
    name: user.name,
    avatar: user.picture,
  };
}

/**
 * Handle OAuth callback - exchange code and create/login user
 */
export async function handleOAuthCallback(
  provider: OAuthProvider,
  code: string
): Promise<{
  success: boolean;
  user?: User;
  accessToken?: string;
  refreshToken?: string;
  error?: string;
}> {
  try {
    // Exchange code for token
    const tokenResponse = await exchangeCodeForToken(provider, code);
    
    if (!tokenResponse.access_token) {
      return { success: false, error: "Failed to get access token" };
    }

    // Get user info based on provider
    let userInfo: {
      providerId: string;
      email: string | null;
      name: string;
      avatar: string;
    };

    if (provider === "github") {
      userInfo = await getGitHubUserInfo(tokenResponse.access_token);
    } else if (provider === "google") {
      userInfo = await getGoogleUserInfo(tokenResponse.access_token);
    } else {
      return { success: false, error: "Unsupported provider" };
    }

    // Create or find user
    const result = await findOrCreateOAuthUser({
      provider,
      providerId: userInfo.providerId,
      email: userInfo.email || undefined,
      name: userInfo.name,
      avatar: userInfo.avatar,
    });

    return {
      success: true,
      user: result.user as unknown as User,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
  } catch (error: unknown) {
    logger.error('OAuth callback failed', {
      error: getErrorMessage(error),
      provider
    });
    const errorMsg = (error && typeof error === 'object' && 'response' in error && error.response && typeof error.response === 'object' && 'data' in error.response && error.response.data && typeof error.response.data === 'object' && 'error_description' in error.response.data)
      ? String(error.response.data.error_description)
      : getErrorMessage(error) || "OAuth authentication failed";
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Generate a random state parameter for CSRF protection
 */
export function generateOAuthState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, "0")).join("");
}
