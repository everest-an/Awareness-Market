import { COOKIE_NAME } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { createLogger } from '../utils/logger';
import { handleOAuthCallback, type OAuthProvider } from '../auth-oauth';

// Session duration: 7 days (not 1 year — reduces exposure window for stolen tokens)
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const logger = createLogger('OAuth');

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

/**
 * Derive the frontend redirect URL from the request origin.
 * Priority: FRONTEND_URL env > OAUTH_CALLBACK_URL env > request origin.
 */
function getFrontendUrl(req: Request): string {
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL;
  if (process.env.OAUTH_CALLBACK_URL) return process.env.OAUTH_CALLBACK_URL;
  // Fall back to the origin of the current request (works in both dev and production)
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return host ? `${proto}://${host}` : 'http://localhost:3000';
}

export function registerOAuthRoutes(app: Express) {
  // Handle OAuth callbacks from Google and GitHub
  // Route: /api/auth/callback/google or /api/auth/callback/github
  app.get("/api/auth/callback/:provider", async (req: Request, res: Response) => {
    const provider = req.params.provider as OAuthProvider;
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    // Validate provider
    if (!["google", "github"].includes(provider)) {
      res.status(400).json({ error: "Invalid OAuth provider" });
      return;
    }

    if (!code) {
      // Check for error from OAuth provider
      const error = getQueryParam(req, "error");
      const errorDescription = getQueryParam(req, "error_description");
      logger.error("[OAuth] Authorization denied", { provider, error, errorDescription });
      res.status(400).json({
        error: error || "code is required",
        error_description: errorDescription,
      });
      return;
    }

    // CSRF protection: validate state against oauth_state cookie
    const storedState = req.cookies?.oauth_state;
    if (!storedState || !state || storedState !== state) {
      logger.warn("[OAuth] State parameter mismatch", {
        provider,
        hasStoredState: !!storedState,
        hasState: !!state,
      });
      // Redirect to auth page with error instead of returning JSON
      // (this is a browser redirect, not an API call)
      const frontendUrl = getFrontendUrl(req);
      res.redirect(302, `${frontendUrl}/auth?error=invalid_state`);
      return;
    }

    // Clear the state cookie (single-use)
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie('oauth_state', cookieOptions);

    try {
      const result = await handleOAuthCallback(provider, code);

      if (!result.success) {
        logger.error("[OAuth] Callback failed", { provider, error: result.error });
        const frontendUrl = getFrontendUrl(req);
        res.redirect(302, `${frontendUrl}/auth?error=${encodeURIComponent(result.error || 'OAuth callback failed')}`);
        return;
      }

      // Set JWT tokens in HTTP-only cookies
      if (result.accessToken && result.refreshToken) {
        res.cookie('jwt_token', result.accessToken, cookieOptions);
        res.cookie('jwt_refresh', result.refreshToken, {
          ...cookieOptions,
          maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        });
      }

      // Redirect to frontend dashboard
      const frontendUrl = getFrontendUrl(req);
      res.redirect(302, `${frontendUrl}/dashboard`);
    } catch (error: unknown) {
      logger.error("[OAuth] Callback exception", { provider, error });
      const frontendUrl = getFrontendUrl(req);
      res.redirect(302, `${frontendUrl}/auth?error=oauth_exception`);
    }
  });

  // Keep legacy /api/oauth/callback route for backward compatibility (deprecated)
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: SESSION_MAX_AGE_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: SESSION_MAX_AGE_MS });

      res.redirect(302, "/");
    } catch (error) {
      logger.error("[OAuth] Legacy callback failed", { error });
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
