/**
 * HTTPS Redirect Middleware
 *
 * Automatically redirects HTTP requests to HTTPS in production.
 * Ensures all traffic is encrypted.
 */

import { Request, Response, NextFunction } from 'express';

export interface HttpsRedirectConfig {
  enabled?: boolean;
  statusCode?: 301 | 302 | 307 | 308;
  excludeHosts?: string[];
  excludePaths?: string[];
  trustProxy?: boolean;
}

const defaultConfig: HttpsRedirectConfig = {
  enabled: true,
  statusCode: 301, // Permanent redirect
  excludeHosts: ['localhost', '127.0.0.1'],
  excludePaths: ['/health', '/ping'],
  trustProxy: true,
};

/**
 * HTTPS redirect middleware
 */
export function httpsRedirect(config: HttpsRedirectConfig = {}) {
  const finalConfig = { ...defaultConfig, ...config };

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip if disabled
    if (!finalConfig.enabled) {
      return next();
    }

    // Skip for excluded hosts
    const host = req.hostname;
    if (finalConfig.excludeHosts?.some(h => host.includes(h))) {
      return next();
    }

    // Skip for excluded paths
    if (finalConfig.excludePaths?.some(p => req.path.startsWith(p))) {
      return next();
    }

    // Check if request is already HTTPS
    const isSecure = finalConfig.trustProxy
      ? req.secure || req.headers['x-forwarded-proto'] === 'https'
      : req.secure;

    if (!isSecure) {
      const secureUrl = `https://${host}${req.originalUrl}`;
      return res.redirect(finalConfig.statusCode || 301, secureUrl);
    }

    next();
  };
}

/**
 * Production HTTPS redirect configuration
 */
export const productionHttpsConfig: HttpsRedirectConfig = {
  enabled: true,
  statusCode: 301,
  excludeHosts: [],
  excludePaths: ['/health'],
  trustProxy: true,
};

/**
 * Development HTTPS redirect configuration (disabled)
 */
export const developmentHttpsConfig: HttpsRedirectConfig = {
  enabled: false,
};

/**
 * Get HTTPS configuration based on environment
 */
export function getHttpsConfig(env: string = process.env.NODE_ENV || 'development'): HttpsRedirectConfig {
  return env === 'production' ? productionHttpsConfig : developmentHttpsConfig;
}
