/**
 * Data Masking Utilities — P1 Security Enhancement
 *
 * Provides functions to mask sensitive data in logs, exports, and API responses
 * for GDPR/CCPA compliance and security best practices.
 */

/**
 * Mask email address (show first 2 chars of local part)
 * Example: john.doe@example.com → jo***@example.com
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return '';

  const [local, domain] = email.split('@');
  if (!domain) return email; // Invalid email format

  const maskedLocal = local.length > 2
    ? `${local.slice(0, 2)}***`
    : '***';

  return `${maskedLocal}@${domain}`;
}

/**
 * Mask phone number (show first 3 and last 4 digits)
 * Example: +1-555-123-4567 → +1-555-***-4567
 * Example: 13812345678 → 138****5678
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '';

  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return '***'; // Too short to mask safely

  const prefix = digits.slice(0, 3);
  const suffix = digits.slice(-4);
  const maskedMiddle = '*'.repeat(Math.max(digits.length - 7, 4));

  return `${prefix}${maskedMiddle}${suffix}`;
}

/**
 * Mask API key or token (show first 8 chars only)
 * Example: sk_live_1234567890abcdef → sk_live_********
 */
export function maskAPIKey(key: string | null | undefined): string {
  if (!key) return '';

  const prefix = key.slice(0, 8);
  return `${prefix}${'*'.repeat(Math.max(key.length - 8, 8))}`;
}

/**
 * Mask credit card number (show last 4 digits)
 * Example: 4242-4242-4242-4242 → ****-****-****-4242
 */
export function maskCreditCard(cardNumber: string | null | undefined): string {
  if (!cardNumber) return '';

  const digits = cardNumber.replace(/\D/g, '');
  if (digits.length < 4) return '****';

  const last4 = digits.slice(-4);
  const maskedPart = '*'.repeat(Math.max(digits.length - 4, 12));

  // Format as ****-****-****-1234
  return maskedPart.match(/.{1,4}/g)?.join('-') + '-' + last4;
}

/**
 * Mask IP address (show first 2 octets)
 * Example: 192.168.1.100 → 192.168.*.*
 */
export function maskIPAddress(ip: string | null | undefined): string {
  if (!ip) return '';

  const parts = ip.split('.');
  if (parts.length !== 4) return '***'; // Invalid IP format

  return `${parts[0]}.${parts[1]}.*.*`;
}

/**
 * Mask user ID (keep only first 4 chars for debugging)
 * Example: user_1234567890abcdef → user_1234***
 */
export function maskUserId(userId: string | null | undefined): string {
  if (!userId) return '';

  if (userId.includes('_')) {
    const [prefix, id] = userId.split('_');
    return `${prefix}_${id.slice(0, 4)}***`;
  }

  return userId.slice(0, 4) + '***';
}

/**
 * Remove sensitive patterns from text using regex
 * Detects and masks: emails, API keys, tokens, passwords, credit cards
 */
export function sanitizeTextContent(text: string | null | undefined): string {
  if (!text) return '';

  let sanitized = text;

  // Mask emails
  sanitized = sanitized.replace(
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    (match) => maskEmail(match)
  );

  // Mask API keys (sk_, pk_, etc.)
  sanitized = sanitized.replace(
    /\b(sk|pk|api|key|token)_[a-zA-Z0-9]{20,}\b/gi,
    '[REDACTED_API_KEY]'
  );

  // Mask credit card numbers (simple pattern)
  sanitized = sanitized.replace(
    /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    '****-****-****-****'
  );

  // Mask passwords in logs (password=xxx, pwd=xxx, etc.)
  sanitized = sanitized.replace(
    /(password|pwd|pass|secret)[=:]\s*[^\s,}]+/gi,
    '$1=[REDACTED]'
  );

  // Mask JWTs
  sanitized = sanitized.replace(
    /\beyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g,
    '[REDACTED_JWT]'
  );

  return sanitized;
}

/**
 * Mask all sensitive fields in an object recursively
 */
export function maskSensitiveFields(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;

  const sensitiveKeys = [
    'password', 'pwd', 'secret', 'token', 'apiKey', 'api_key',
    'creditCard', 'credit_card', 'ssn', 'socialSecurity',
    'privateKey', 'private_key'
  ];

  const masked = Array.isArray(obj) ? [...obj] : { ...obj };

  for (const key in masked) {
    const lowerKey = key.toLowerCase();

    // Check if key is sensitive
    if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
      masked[key] = '[REDACTED]';
    }
    // Handle email fields
    else if (lowerKey.includes('email') && typeof masked[key] === 'string') {
      masked[key] = maskEmail(masked[key]);
    }
    // Handle phone fields
    else if (lowerKey.includes('phone') && typeof masked[key] === 'string') {
      masked[key] = maskPhone(masked[key]);
    }
    // Recursively mask nested objects
    else if (typeof masked[key] === 'object') {
      masked[key] = maskSensitiveFields(masked[key]);
    }
  }

  return masked;
}

/**
 * Create a safe logger that automatically masks sensitive data
 */
export function createSafeLogger(namespace: string) {
  const log = (level: 'info' | 'warn' | 'error', message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    const sanitizedMessage = sanitizeTextContent(message);
    const sanitizedData = data ? maskSensitiveFields(data) : undefined;

    const logEntry = {
      timestamp,
      level,
      namespace,
      message: sanitizedMessage,
      data: sanitizedData,
    };

    console[level === 'error' ? 'error' : 'log'](JSON.stringify(logEntry));
  };

  return {
    info: (message: string, data?: any) => log('info', message, data),
    warn: (message: string, data?: any) => log('warn', message, data),
    error: (message: string, data?: any) => log('error', message, data),
  };
}
