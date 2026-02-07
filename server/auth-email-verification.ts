/**
 * Email Verification Module
 * 
 * Handles email verification for new user registrations.
 * 
 * ## Flow
 * 1. User registers with email/password
 * 2. System sends verification email with 6-digit code
 * 3. User enters code on verification page
 * 4. Account is marked as verified
 * 
 * ## Features
 * - 6-digit verification codes
 * - 24-hour code expiration
 * - Resend functionality with rate limiting
 * - Verification status tracking
 */

import { prisma } from "./db-prisma";
import { sendEmail } from "./email-service";
import { createLogger } from './utils/logger';
import crypto from 'crypto';

const logger = createLogger('Auth:Email');

// Verification code storage (in-memory, use Redis in production)
interface VerificationEntry {
  code: string;
  email: string;
  userId: number;
  createdAt: number;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
}

const verificationCodes = new Map<string, VerificationEntry>();

// Configuration
const CODE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const RESEND_COOLDOWN_MS = 60 * 1000; // 1 minute between resends
const MAX_VERIFY_ATTEMPTS = 5;

/**
 * Generate a cryptographically secure 6-digit verification code
 */
function generateCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Send verification email to user
 */
export async function sendVerificationEmail(
  userId: number,
  email: string
): Promise<{ success: boolean; error?: string }> {
  const now = Date.now();
  const existingEntry = verificationCodes.get(email.toLowerCase());

  // Check resend cooldown
  if (existingEntry && now - existingEntry.lastSentAt < RESEND_COOLDOWN_MS) {
    const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - (now - existingEntry.lastSentAt)) / 1000);
    return { 
      success: false, 
      error: `Please wait ${waitSeconds} seconds before requesting another code` 
    };
  }

  // Generate new code
  const code = generateCode();
  const expiresAt = now + CODE_EXPIRY_MS;

  // Store verification entry
  verificationCodes.set(email.toLowerCase(), {
    code,
    email: email.toLowerCase(),
    userId,
    createdAt: now,
    expiresAt,
    attempts: 0,
    lastSentAt: now,
  });

  // Send email
  const emailSent = await sendEmail({
    to: email,
    subject: "Verify Your Awareness Account",
    html: generateVerificationEmailHtml(code),
    text: generateVerificationEmailText(code),
  });

  if (!emailSent) {
    return { success: false, error: "Failed to send verification email" };
  }

  logger.info(`[EmailVerification] Sent verification code to ${email}`);
  return { success: true };
}

/**
 * Verify email with code
 */
export async function verifyEmail(
  email: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  const entry = verificationCodes.get(email.toLowerCase());

  if (!entry) {
    return { success: false, error: "No verification code found. Please request a new one." };
  }

  // Check expiration
  if (Date.now() > entry.expiresAt) {
    verificationCodes.delete(email.toLowerCase());
    return { success: false, error: "Verification code has expired. Please request a new one." };
  }

  // Check attempts
  if (entry.attempts >= MAX_VERIFY_ATTEMPTS) {
    verificationCodes.delete(email.toLowerCase());
    return { success: false, error: "Too many failed attempts. Please request a new code." };
  }

  // Verify code using timing-safe comparison
  const codeBuffer = Buffer.from(entry.code.padEnd(6, '0'));
  const inputBuffer = Buffer.from(code.padEnd(6, '0'));
  if (!crypto.timingSafeEqual(codeBuffer, inputBuffer)) {
    entry.attempts++;
    const remaining = MAX_VERIFY_ATTEMPTS - entry.attempts;
    return { 
      success: false, 
      error: `Invalid code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.` 
    };
  }

  // Mark user as verified in database
  await prisma.user.update({
    where: { id: entry.userId },
    data: { emailVerified: true }
  });

  // Clean up
  verificationCodes.delete(email.toLowerCase());

  logger.info(`[EmailVerification] Email verified for user ${entry.userId}`);
  return { success: true };
}

/**
 * Check if email is verified
 */
export async function isEmailVerified(userId: number): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailVerified: true }
  });

  return user?.emailVerified === true;
}

/**
 * Get verification status for email
 */
export function getVerificationStatus(email: string): {
  hasPendingCode: boolean;
  canResend: boolean;
  expiresIn?: number;
} {
  const entry = verificationCodes.get(email.toLowerCase());
  const now = Date.now();

  if (!entry) {
    return { hasPendingCode: false, canResend: true };
  }

  if (now > entry.expiresAt) {
    verificationCodes.delete(email.toLowerCase());
    return { hasPendingCode: false, canResend: true };
  }

  return {
    hasPendingCode: true,
    canResend: now - entry.lastSentAt >= RESEND_COOLDOWN_MS,
    expiresIn: Math.ceil((entry.expiresAt - now) / 1000),
  };
}

/**
 * Generate verification email HTML
 */
function generateVerificationEmailHtml(code: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .code-box { background: white; border: 2px dashed #06b6d4; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
        .code { font-size: 36px; font-weight: bold; color: #06b6d4; letter-spacing: 8px; }
        .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
        .highlight { background: #ecfeff; border-left: 4px solid #06b6d4; padding: 12px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✉️ Verify Your Email</h1>
        </div>
        <div class="content">
          <p>Welcome to Awareness Market!</p>
          <p>Please use the verification code below to complete your registration:</p>
          
          <div class="code-box">
            <div class="code">${code}</div>
          </div>
          
          <div class="highlight">
            <strong>📌 This code will expire in 24 hours.</strong>
          </div>
          
          <p>If you didn't create an account with Awareness, you can safely ignore this email.</p>
          
          <div class="footer">
            <p>© 2026 Awareness Market. All rights reserved.</p>
            <p>This is an automated message, please do not reply.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate verification email plain text
 */
function generateVerificationEmailText(code: string): string {
  return `
Welcome to Awareness Market!

Please use the verification code below to complete your registration:

${code}

This code will expire in 24 hours.

If you didn't create an account with Awareness, you can safely ignore this email.

© 2026 Awareness Market. All rights reserved.
  `.trim();
}
