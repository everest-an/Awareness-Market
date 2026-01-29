/**
 * Security Headers Middleware
 *
 * Implements security best practices through HTTP headers.
 * Protects against XSS, clickjacking, and other common attacks.
 */

import { Request, Response, NextFunction } from 'express';

export interface SecurityHeadersConfig {
  // Enable/disable specific headers
  enableHSTS?: boolean;
  enableCSP?: boolean;
  enableXFrameOptions?: boolean;
  enableXContentTypeOptions?: boolean;
  enableReferrerPolicy?: boolean;
  enablePermissionsPolicy?: boolean;

  // HSTS configuration
  hstsMaxAge?: number; // seconds
  hstsIncludeSubDomains?: boolean;
  hstsPreload?: boolean;

  // CSP configuration
  cspDirectives?: Record<string, string[]>;
  cspReportUri?: string;

  // Frame options
  frameOptions?: 'DENY' | 'SAMEORIGIN' | 'ALLOW-FROM';
  frameAllowFrom?: string;

  // Referrer policy
  referrerPolicy?: string;

  // Permissions policy
  permissionsPolicy?: Record<string, string[]>;
}

/**
 * Default security configuration
 */
const defaultConfig: SecurityHeadersConfig = {
  enableHSTS: true,
  enableCSP: true,
  enableXFrameOptions: true,
  enableXContentTypeOptions: true,
  enableReferrerPolicy: true,
  enablePermissionsPolicy: true,

  hstsMaxAge: 31536000, // 1 year
  hstsIncludeSubDomains: true,
  hstsPreload: true,

  cspDirectives: {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'https:'],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'"],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
  },

  frameOptions: 'DENY',
  referrerPolicy: 'no-referrer-when-downgrade',

  permissionsPolicy: {
    'camera': ["'none'"],
    'microphone': ["'none'"],
    'geolocation': ["'none'"],
    'payment': ["'self'"],
  },
};

/**
 * Security headers middleware
 */
export function securityHeaders(config: SecurityHeadersConfig = {}) {
  const finalConfig = { ...defaultConfig, ...config };

  return (req: Request, res: Response, next: NextFunction) => {
    // 1. Strict-Transport-Security (HSTS)
    if (finalConfig.enableHSTS && req.secure) {
      let hstsValue = `max-age=${finalConfig.hstsMaxAge}`;
      if (finalConfig.hstsIncludeSubDomains) {
        hstsValue += '; includeSubDomains';
      }
      if (finalConfig.hstsPreload) {
        hstsValue += '; preload';
      }
      res.setHeader('Strict-Transport-Security', hstsValue);
    }

    // 2. Content-Security-Policy (CSP)
    if (finalConfig.enableCSP && finalConfig.cspDirectives) {
      const cspValue = Object.entries(finalConfig.cspDirectives)
        .map(([directive, values]) => `${directive} ${values.join(' ')}`)
        .join('; ');

      res.setHeader('Content-Security-Policy', cspValue);

      // Report-only version for testing
      if (finalConfig.cspReportUri) {
        res.setHeader(
          'Content-Security-Policy-Report-Only',
          cspValue + `; report-uri ${finalConfig.cspReportUri}`
        );
      }
    }

    // 3. X-Frame-Options
    if (finalConfig.enableXFrameOptions) {
      if (finalConfig.frameOptions === 'ALLOW-FROM' && finalConfig.frameAllowFrom) {
        res.setHeader('X-Frame-Options', `ALLOW-FROM ${finalConfig.frameAllowFrom}`);
      } else {
        res.setHeader('X-Frame-Options', finalConfig.frameOptions || 'DENY');
      }
    }

    // 4. X-Content-Type-Options
    if (finalConfig.enableXContentTypeOptions) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }

    // 5. X-XSS-Protection (legacy, but still useful for older browsers)
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // 6. Referrer-Policy
    if (finalConfig.enableReferrerPolicy) {
      res.setHeader('Referrer-Policy', finalConfig.referrerPolicy || 'no-referrer-when-downgrade');
    }

    // 7. Permissions-Policy (formerly Feature-Policy)
    if (finalConfig.enablePermissionsPolicy && finalConfig.permissionsPolicy) {
      const permissionsValue = Object.entries(finalConfig.permissionsPolicy)
        .map(([feature, allowlist]) => `${feature}=(${allowlist.join(' ')})`)
        .join(', ');

      res.setHeader('Permissions-Policy', permissionsValue);
    }

    // 8. X-Powered-By (remove to hide tech stack)
    res.removeHeader('X-Powered-By');

    // 9. X-DNS-Prefetch-Control
    res.setHeader('X-DNS-Prefetch-Control', 'off');

    // 10. X-Download-Options (IE8+)
    res.setHeader('X-Download-Options', 'noopen');

    // 11. X-Permitted-Cross-Domain-Policies
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

    next();
  };
}

/**
 * Production-ready security configuration
 */
export const productionSecurityConfig: SecurityHeadersConfig = {
  enableHSTS: true,
  enableCSP: true,
  enableXFrameOptions: true,
  enableXContentTypeOptions: true,
  enableReferrerPolicy: true,
  enablePermissionsPolicy: true,

  hstsMaxAge: 63072000, // 2 years
  hstsIncludeSubDomains: true,
  hstsPreload: true,

  cspDirectives: {
    'default-src': ["'self'"],
    'script-src': ["'self'"],
    'style-src': ["'self'"],
    'img-src': ["'self'", 'data:', 'https:'],
    'font-src': ["'self'"],
    'connect-src': ["'self'", 'https://api.stripe.com'],
    'frame-src': ["'none'"],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'upgrade-insecure-requests': [],
  },

  frameOptions: 'DENY',
  referrerPolicy: 'strict-origin-when-cross-origin',

  permissionsPolicy: {
    'camera': ["'none'"],
    'microphone': ["'none'"],
    'geolocation': ["'none'"],
    'payment': ["'self'"],
    'usb': ["'none'"],
    'bluetooth': ["'none'"],
  },
};

/**
 * Development security configuration (more permissive)
 */
export const developmentSecurityConfig: SecurityHeadersConfig = {
  enableHSTS: false, // Disabled in dev (no HTTPS)
  enableCSP: true,
  enableXFrameOptions: true,
  enableXContentTypeOptions: true,
  enableReferrerPolicy: true,
  enablePermissionsPolicy: false,

  cspDirectives: {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Allow for HMR
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'https:', 'http:'],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'", 'ws:', 'wss:'], // Allow WebSocket for HMR
    'frame-ancestors': ["'self'"],
  },

  frameOptions: 'SAMEORIGIN',
  referrerPolicy: 'no-referrer-when-downgrade',
};

/**
 * Get security configuration based on environment
 */
export function getSecurityConfig(env: string = process.env.NODE_ENV || 'development'): SecurityHeadersConfig {
  return env === 'production' ? productionSecurityConfig : developmentSecurityConfig;
}
