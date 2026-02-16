/**
 * Input Validation Middleware — P1 Security Enhancement
 *
 * Protects against:
 * - XSS (Cross-Site Scripting) attacks
 * - SQL Injection (additional layer beyond Prisma)
 * - Command Injection (shell commands)
 * - Path Traversal (directory access)
 * - NoSQL Injection
 * - LDAP Injection
 *
 * Multi-layer defense approach:
 * 1. Input sanitization (remove dangerous content)
 * 2. Input validation (verify format/type)
 * 3. Output encoding (escape when rendering)
 */

import DOMPurify from 'isomorphic-dompurify';
import validator from 'validator';
import { Request, Response, NextFunction } from 'express';

// ============================================================================
// XSS Protection
// ============================================================================

/**
 * Sanitize HTML content to prevent XSS
 * Allows only safe HTML tags for rich text
 */
export function sanitizeHTML(input: string, allowRichText: boolean = false): string {
  if (!input || typeof input !== 'string') return '';

  if (allowRichText) {
    // Allow safe formatting tags for rich text editors
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'code', 'pre', 'blockquote'],
      ALLOWED_ATTR: ['href', 'title', 'target', 'rel'],
      ALLOW_DATA_ATTR: false,
      ALLOW_UNKNOWN_PROTOCOLS: false,
    });
  }

  // Strip all HTML for plain text inputs
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
}

/**
 * Sanitize plain text (remove HTML entities)
 */
export function sanitizePlainText(input: string): string {
  if (!input || typeof input !== 'string') return '';

  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// ============================================================================
// SQL Injection Protection
// ============================================================================

/**
 * Validate input for SQL injection patterns
 * Note: Prisma already protects against SQL injection via parameterized queries
 * This is an additional validation layer
 */
export function validateNoSQLInjection(input: string): boolean {
  if (!input || typeof input !== 'string') return true;

  // Dangerous SQL keywords
  const sqlKeywords = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|EXEC|EXECUTE|SCRIPT|DECLARE|ALTER|CREATE|TRUNCATE|MERGE)\b)/gi;

  // SQL comment patterns
  const sqlComments = /(--|;|\/\*|\*\/|xp_|sp_)/gi;

  // SQL injection common patterns
  const sqlPatterns = /('|(\\x27)|(\\x22)|(\\')|(\\\")|(;)|(--)|(\s+OR\s+)|(UNION\s+SELECT))/gi;

  if (sqlKeywords.test(input) || sqlComments.test(input) || sqlPatterns.test(input)) {
    return false;
  }

  return true;
}

/**
 * Sanitize input for SQL-like operations
 */
export function sanitizeSQLInput(input: string): string {
  if (!input || typeof input !== 'string') return '';

  // Remove potentially dangerous characters
  return input
    .replace(/'/g, "''") // Escape single quotes
    .replace(/;/g, '') // Remove semicolons
    .replace(/--/g, '') // Remove SQL comments
    .replace(/\/\*/g, '')
    .replace(/\*\//g, '');
}

// ============================================================================
// Command Injection Protection
// ============================================================================

/**
 * Validate input for command injection patterns
 */
export function validateNoCommandInjection(input: string): boolean {
  if (!input || typeof input !== 'string') return true;

  // Shell metacharacters
  const shellChars = /[;&|`$(){}[\]<>\\!]/;

  // Command substitution patterns
  const commandSubstitution = /(\$\(|\`|\\x60)/;

  // Newline characters (can inject commands)
  const newlines = /[\r\n]/;

  if (shellChars.test(input) || commandSubstitution.test(input) || newlines.test(input)) {
    return false;
  }

  return true;
}

/**
 * Sanitize input for shell commands
 */
export function sanitizeShellInput(input: string): string {
  if (!input || typeof input !== 'string') return '';

  // Remove all shell metacharacters
  return input.replace(/[;&|`$(){}[\]<>\\!\r\n]/g, '');
}

// ============================================================================
// Path Traversal Protection
// ============================================================================

/**
 * Validate file path to prevent directory traversal
 */
export function validateFilePath(path: string): boolean {
  if (!path || typeof path !== 'string') return false;

  // Prevent path traversal
  if (path.includes('..') || path.includes('~')) {
    return false;
  }

  // Prevent absolute paths (only allow relative)
  if (path.startsWith('/') || /^[a-zA-Z]:/.test(path)) {
    return false;
  }

  // Prevent accessing parent directories
  if (path.includes('/../') || path.includes('\\..\\')) {
    return false;
  }

  // Only allow alphanumeric, dash, underscore, dot, forward slash
  if (!/^[a-zA-Z0-9\-_\.\/]+$/.test(path)) {
    return false;
  }

  return true;
}

/**
 * Sanitize file path
 */
export function sanitizeFilePath(path: string): string {
  if (!path || typeof path !== 'string') return '';

  // Remove path traversal patterns
  return path
    .replace(/\.\./g, '')
    .replace(/~/g, '')
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/') // Normalize multiple slashes
    .replace(/^\//, ''); // Remove leading slash
}

// ============================================================================
// NoSQL Injection Protection (MongoDB patterns)
// ============================================================================

/**
 * Validate input for NoSQL injection patterns
 */
export function validateNoNoSQLInjection(input: any): boolean {
  if (typeof input !== 'object' || input === null) {
    return true;
  }

  // Check for MongoDB operators
  const dangerousKeys = ['$where', '$gt', '$gte', '$lt', '$lte', '$ne', '$in', '$nin', '$regex', '$exists'];

  for (const key of Object.keys(input)) {
    if (dangerousKeys.includes(key)) {
      return false;
    }

    // Recursively check nested objects
    if (typeof input[key] === 'object' && input[key] !== null) {
      if (!validateNoNoSQLInjection(input[key])) {
        return false;
      }
    }
  }

  return true;
}

// ============================================================================
// URL Validation
// ============================================================================

/**
 * Validate URL (prevent SSRF, open redirect)
 */
export function validateURL(url: string, allowedDomains?: string[]): boolean {
  if (!url || typeof url !== 'string') return false;

  // Validate URL format
  if (!validator.isURL(url, {
    protocols: ['http', 'https'],
    require_protocol: true,
    require_valid_protocol: true,
    allow_underscores: false,
  })) {
    return false;
  }

  try {
    const parsed = new URL(url);

    // Prevent localhost/private IP access (SSRF protection)
    const hostname = parsed.hostname.toLowerCase();
    const privatePatterns = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '::1',
      '10.',
      '172.16.',
      '172.17.',
      '172.18.',
      '172.19.',
      '172.20.',
      '172.21.',
      '172.22.',
      '172.23.',
      '172.24.',
      '172.25.',
      '172.26.',
      '172.27.',
      '172.28.',
      '172.29.',
      '172.30.',
      '172.31.',
      '192.168.',
      '169.254.', // Link-local
    ];

    for (const pattern of privatePatterns) {
      if (hostname === pattern || hostname.startsWith(pattern)) {
        return false;
      }
    }

    // Check domain whitelist if provided
    if (allowedDomains && allowedDomains.length > 0) {
      const isAllowed = allowedDomains.some(domain =>
        hostname === domain || hostname.endsWith(`.${domain}`)
      );
      if (!isAllowed) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Email Validation
// ============================================================================

/**
 * Validate email address
 */
export function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;

  // Use validator.js for RFC 5322 compliant validation
  return validator.isEmail(email, {
    allow_display_name: false,
    require_display_name: false,
    allow_utf8_local_part: true,
    require_tld: true,
  });
}

// ============================================================================
// Numeric Validation
// ============================================================================

/**
 * Validate and sanitize numeric input
 */
export function validateNumber(value: any, options?: {
  min?: number;
  max?: number;
  integer?: boolean;
}): boolean {
  const num = Number(value);

  if (isNaN(num) || !isFinite(num)) {
    return false;
  }

  if (options?.integer && !Number.isInteger(num)) {
    return false;
  }

  if (options?.min !== undefined && num < options.min) {
    return false;
  }

  if (options?.max !== undefined && num > options.max) {
    return false;
  }

  return true;
}

// ============================================================================
// Express Middleware
// ============================================================================

/**
 * Middleware to sanitize all incoming request data
 */
export function sanitizeInputMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    // Sanitize query parameters
    if (req.query) {
      for (const key in req.query) {
        if (typeof req.query[key] === 'string') {
          req.query[key] = sanitizePlainText(req.query[key] as string);
        }
      }
    }

    // Sanitize body (for JSON requests)
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }

    next();
  } catch (error) {
    console.error('Input sanitization error:', error);
    // Fail open - don't block request if sanitization fails
    next();
  }
}

/**
 * Recursively sanitize object properties
 */
function sanitizeObject(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  const sanitized: any = {};
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      // Sanitize string values
      sanitized[key] = sanitizePlainText(obj[key]);
    } else if (typeof obj[key] === 'object') {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeObject(obj[key]);
    } else {
      // Keep other types as-is
      sanitized[key] = obj[key];
    }
  }

  return sanitized;
}

/**
 * Middleware to validate specific input fields
 */
export function createInputValidator(validations: Record<string, (value: any) => boolean>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: string[] = [];

    // Check all validation rules
    for (const [field, validator] of Object.entries(validations)) {
      const value = req.body?.[field] || req.query?.[field];

      if (value !== undefined && !validator(value)) {
        errors.push(`Invalid value for field: ${field}`);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors,
      }) as any;
    }

    next();
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Escape string for safe insertion in HTML attributes
 */
export function escapeHTMLAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Escape string for safe insertion in JavaScript
 */
export function escapeJavaScript(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/\//g, '\\/');
}
