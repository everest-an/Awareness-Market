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

// Initialize Resend client lazily to avoid startup crash when API key is missing
let resendClient: Resend | null = null;

const getResendClient = () => {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY || "");
  }
  return resendClient;
};

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

    if (!process.env.RESEND_API_KEY) {
      console.error("[Email] RESEND_API_KEY is not set");
      return false;
    }

    // Send email via Resend
    const resend = getResendClient();
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


/**
 * Send purchase confirmation email to buyer
 */
export async function sendPurchaseConfirmationEmail(
  buyerEmail: string,
  packageName: string,
  packageType: 'vector' | 'memory' | 'chain',
  price: string,
  downloadUrl?: string
): Promise<boolean> {
  const subject = `Purchase Confirmed: ${packageName}`;
  const packageTypeLabel = packageType === 'vector' ? 'Vector Package' : 
                           packageType === 'memory' ? 'Memory Package' : 'Chain Package';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .package-box { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .price { font-size: 24px; font-weight: bold; color: #10b981; }
        .download-btn { display: inline-block; background: #10b981; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 15px; }
        .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Purchase Confirmed!</h1>
        </div>
        <div class="content">
          <p>Thank you for your purchase on Awareness Market!</p>
          
          <div class="package-box">
            <h3 style="margin-top: 0;">${packageName}</h3>
            <p><strong>Type:</strong> ${packageTypeLabel}</p>
            <p><strong>Price:</strong> <span class="price">$${price}</span></p>
            ${downloadUrl ? `<a href="${downloadUrl}" class="download-btn">Download Package</a>` : ''}
          </div>
          
          <h3>What's Next?</h3>
          <ul>
            <li>Download your package from your dashboard</li>
            <li>Extract the W-Matrix and data files</li>
            <li>Integrate with your AI pipeline</li>
            <li>Check our SDK documentation for integration guides</li>
          </ul>
          
          <p>If you have any questions, visit our <a href="https://awareness.market/docs">documentation</a> or contact support.</p>
          
          <div class="footer">
            <p>© 2026 Awareness Market. All rights reserved.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Purchase Confirmed!

Thank you for your purchase on Awareness Market!

Package: ${packageName}
Type: ${packageTypeLabel}
Price: $${price}

${downloadUrl ? `Download: ${downloadUrl}` : 'Download from your dashboard'}

What's Next?
- Download your package from your dashboard
- Extract the W-Matrix and data files
- Integrate with your AI pipeline
- Check our SDK documentation for integration guides

© 2026 Awareness Market. All rights reserved.
  `;

  return sendEmail({
    to: buyerEmail,
    subject,
    html,
    text,
  });
}

/**
 * Send sale notification email to seller
 */
export async function sendSaleNotificationEmail(
  sellerEmail: string,
  packageName: string,
  buyerName: string,
  price: string,
  earnings: string
): Promise<boolean> {
  const subject = `New Sale: ${packageName}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .sale-box { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .earnings { font-size: 28px; font-weight: bold; color: #8b5cf6; }
        .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>💰 You Made a Sale!</h1>
        </div>
        <div class="content">
          <p>Great news! Someone just purchased your package.</p>
          
          <div class="sale-box">
            <h3 style="margin-top: 0;">${packageName}</h3>
            <p><strong>Buyer:</strong> ${buyerName}</p>
            <p><strong>Sale Price:</strong> $${price}</p>
            <p><strong>Your Earnings:</strong> <span class="earnings">$${earnings}</span></p>
            <p style="color: #6b7280; font-size: 14px;">(10% platform fee deducted)</p>
          </div>
          
          <p>Keep creating great packages to grow your earnings!</p>
          
          <div class="footer">
            <p>© 2026 Awareness Market. All rights reserved.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
You Made a Sale!

Great news! Someone just purchased your package.

Package: ${packageName}
Buyer: ${buyerName}
Sale Price: $${price}
Your Earnings: $${earnings} (10% platform fee deducted)

Keep creating great packages to grow your earnings!

© 2026 Awareness Market. All rights reserved.
  `;

  return sendEmail({
    to: sellerEmail,
    subject,
    html,
    text,
  });
}
