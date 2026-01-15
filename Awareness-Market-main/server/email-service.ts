/**
 * Email Service for sending verification codes and notifications
 * Uses Resend for email delivery
 */

import { Resend } from 'resend';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

// Email configuration
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@awareness.market';
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || 'Awareness Market';

/**
 * Send an email using Resend
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    // In development, just log the email
    if (process.env.NODE_ENV !== "production" && !process.env.RESEND_API_KEY) {
      console.log("\n=== EMAIL SENT (DEV MODE) ===");
      console.log(`To: ${options.to}`);
      console.log(`Subject: ${options.subject}`);
      console.log(`Body:\n${options.text || options.html}`);
      console.log("=============================\n");
      return true;
    }

    // Send email via Resend
    const { data, error } = await resend.emails.send({
      from: `${EMAIL_FROM_NAME} <${EMAIL_FROM}>`,
      to: [options.to],
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    if (error) {
      console.error('[Email] Resend error:', error);
      return false;
    }

    console.log(`[Email] Successfully sent to ${options.to} (ID: ${data?.id})`);
    return true;
  } catch (error) {
    console.error("[Email] Failed to send email:", error);
    return false;
  }
}

/**
 * Send password reset verification code email
 */
export async function sendPasswordResetEmail(
  email: string,
  code: string,
  expiresInMinutes: number = 10
): Promise<boolean> {
  const subject = "Reset Your Awareness Password";
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .code-box { background: white; border: 2px dashed #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
        .code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 8px; }
        .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
        .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 Password Reset Request</h1>
        </div>
        <div class="content">
          <p>Hello,</p>
          <p>We received a request to reset your password for your Awareness account. Use the verification code below to complete the process:</p>
          
          <div class="code-box">
            <div class="code">${code}</div>
          </div>
          
          <p><strong>This code will expire in ${expiresInMinutes} minutes.</strong></p>
          
          <div class="warning">
            <strong>⚠️ Security Notice:</strong> If you didn't request this password reset, please ignore this email. Your account is still secure.
          </div>
          
          <p>For security reasons, never share this code with anyone. The Awareness team will never ask you for this code.</p>
          
          <div class="footer">
            <p>© 2026 Awareness Market. All rights reserved.</p>
            <p>This is an automated message, please do not reply.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Password Reset Request

We received a request to reset your password for your Awareness account.

Your verification code is: ${code}

This code will expire in ${expiresInMinutes} minutes.

If you didn't request this password reset, please ignore this email. Your account is still secure.

For security reasons, never share this code with anyone.

© 2026 Awareness Market. All rights reserved.
  `;

  return sendEmail({
    to: email,
    subject,
    html,
    text,
  });
}

/**
 * Generate a 6-digit verification code
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
