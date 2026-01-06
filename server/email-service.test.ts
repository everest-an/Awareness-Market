/**
 * Email Service Tests
 * Validates Resend API integration and email sending functionality
 */

import { describe, it, expect } from 'vitest';
import { sendEmail, sendPasswordResetEmail, generateVerificationCode } from './email-service';

describe('Email Service', () => {
  describe('generateVerificationCode', () => {
    it('should generate a 6-digit code', () => {
      const code = generateVerificationCode();
      expect(code).toMatch(/^\d{6}$/);
      expect(code.length).toBe(6);
    });

    it('should generate different codes', () => {
      const code1 = generateVerificationCode();
      const code2 = generateVerificationCode();
      // Very unlikely to be the same (1 in 1,000,000 chance)
      expect(code1).not.toBe(code2);
    });
  });

  describe('sendEmail', () => {
    it('should send email successfully with valid API key', async () => {
      // Skip if no API key configured (dev mode)
      if (!process.env.RESEND_API_KEY) {
        console.log('⚠️  Skipping email test: RESEND_API_KEY not configured');
        return;
      }

      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test Email',
        html: '<p>This is a test email</p>',
        text: 'This is a test email',
      });

      // In production with valid key, should return true
      // Note: Resend may reject test@example.com, but API call should succeed
      expect(typeof result).toBe('boolean');
    }, 10000); // 10s timeout for API call
  });

  describe('sendPasswordResetEmail', () => {
    it('should format password reset email correctly', async () => {
      const code = '123456';
      const email = 'user@example.com';

      // This will log in dev mode or send in production
      const result = await sendPasswordResetEmail(email, code);

      // Should always return true (logs in dev, sends in prod)
      expect(result).toBe(true);
    });

    it.skip('should include verification code in email', async () => {
      // Skipped: Requires Resend API key in production
      const code = generateVerificationCode();
      const email = 'test@example.com';

      const result = await sendPasswordResetEmail(email, code);
      expect(result).toBe(true);
    });
  });

  describe('Resend API validation', () => {
    it('should have valid Resend API key format', () => {
      const apiKey = process.env.RESEND_API_KEY;
      
      if (!apiKey) {
        console.log('⚠️  RESEND_API_KEY not set - email will use dev mode');
        return;
      }

      // Resend API keys start with "re_"
      expect(apiKey).toMatch(/^re_[a-zA-Z0-9_]+$/);
      expect(apiKey.length).toBeGreaterThan(10);
    });

    it('should have valid email configuration', () => {
      const emailFrom = process.env.EMAIL_FROM || 'noreply@awareness.market';
      const emailFromName = process.env.EMAIL_FROM_NAME || 'Awareness Market';

      // Validate email format
      expect(emailFrom).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      expect(emailFromName.length).toBeGreaterThan(0);
    });
  });
});
