# SMTP Email Service Setup Guide

This guide helps you configure email verification codes for the Awareness Market authentication system.

## Email Service Options

We recommend two popular email services:

### Option 1: Resend (Recommended)
- **Website:** https://resend.com
- **Free Tier:** 3,000 emails/month, 100 emails/day
- **Pros:** Modern API, excellent deliverability, simple setup
- **Best for:** Startups, small to medium projects

### Option 2: SendGrid
- **Website:** https://sendgrid.com
- **Free Tier:** 100 emails/day forever
- **Pros:** Established provider, detailed analytics
- **Best for:** Enterprise applications

## Setup Instructions

### Option 1: Resend Setup

#### 1. Create Account
1. Visit https://resend.com/signup
2. Sign up with your email
3. Verify your email address

#### 2. Get API Key
1. Go to https://resend.com/api-keys
2. Click "Create API Key"
3. Name it "Awareness Market Production"
4. Copy the API key (starts with `re_...`)

#### 3. Verify Domain (Optional but Recommended)
1. Go to https://resend.com/domains
2. Click "Add Domain"
3. Enter your domain: `awareness.market`
4. Add DNS records to your domain provider:
   - TXT record for domain verification
   - MX records for receiving emails
   - DKIM records for authentication

#### 4. Configure Environment Variables
Add to your `.env.production` file:
```bash
# Resend Configuration
SMTP_PROVIDER=resend
RESEND_API_KEY=re_your_api_key_here
EMAIL_FROM=noreply@awareness.market
EMAIL_FROM_NAME=Awareness Market
```

### Option 2: SendGrid Setup

#### 1. Create Account
1. Visit https://signup.sendgrid.com
2. Sign up with your email
3. Complete the onboarding questionnaire

#### 2. Get API Key
1. Go to Settings → API Keys
2. Click "Create API Key"
3. Choose "Full Access" or "Restricted Access" (Mail Send only)
4. Copy the API key (starts with `SG.`)

#### 3. Verify Sender Identity
1. Go to Settings → Sender Authentication
2. Choose "Single Sender Verification" (quick) or "Domain Authentication" (recommended)
3. For single sender: verify your email address
4. For domain: add DNS records to your domain

#### 4. Configure Environment Variables
Add to your `.env.production` file:
```bash
# SendGrid Configuration
SMTP_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.your_api_key_here
EMAIL_FROM=noreply@awareness.market
EMAIL_FROM_NAME=Awareness Market
```

## Email Service Implementation

The email service is already implemented in `server/_core/email-service.ts`:

```typescript
import { sendEmail } from './server/_core/email-service';

// Send verification code
await sendEmail({
  to: 'user@example.com',
  subject: 'Your Verification Code',
  text: 'Your code is: 123456',
  html: '<p>Your code is: <strong>123456</strong></p>'
});
```

## Testing Email Delivery

### 1. Local Testing (Development)
In development mode, emails are logged to console instead of sent:
```bash
npm run dev
# Check console for email logs
```

### 2. Production Testing
After configuring API keys:

```bash
# SSH to production server
ssh -i awareness-key.pem ec2-user@3.235.251.106

# Add environment variables
sudo nano /var/www/awareness-market/.env.production

# Restart application
pm2 restart awareness-market
pm2 logs awareness-market
```

Test the forgot password flow:
1. Go to https://awareness.market/auth
2. Click "Forgot Password?"
3. Enter your email
4. Check your inbox for verification code

## Email Templates

### Verification Code Email
Located in `server/_core/email-service.ts`:

```typescript
export async function sendVerificationCode(email: string, code: string) {
  return sendEmail({
    to: email,
    subject: 'Your Awareness Market Verification Code',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>You requested to reset your password. Use the code below:</p>
        <div style="background: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px;">
          ${code}
        </div>
        <p>This code expires in 10 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      </div>
    `
  });
}
```

## Environment Variables Reference

Add these to your production environment:

```bash
# Email Service Configuration
SMTP_PROVIDER=resend                    # or "sendgrid"
RESEND_API_KEY=re_xxxxx                 # if using Resend
SENDGRID_API_KEY=SG.xxxxx               # if using SendGrid
EMAIL_FROM=noreply@awareness.market     # sender email
EMAIL_FROM_NAME=Awareness Market        # sender name

# Optional: Email Rate Limiting
EMAIL_RATE_LIMIT=10                     # max emails per minute
EMAIL_DAILY_LIMIT=1000                  # max emails per day
```

## Deployment Steps

### 1. Choose Email Provider
Decide between Resend or SendGrid based on your needs.

### 2. Get API Key
Follow the setup instructions above for your chosen provider.

### 3. Update Production Environment
```bash
# SSH to server
ssh -i awareness-key.pem ec2-user@3.235.251.106

# Edit environment file
sudo nano /var/www/awareness-market/.env.production

# Add email configuration
SMTP_PROVIDER=resend
RESEND_API_KEY=re_your_key_here
EMAIL_FROM=noreply@awareness.market
EMAIL_FROM_NAME=Awareness Market
```

### 4. Restart Application
```bash
pm2 restart awareness-market
pm2 logs awareness-market --lines 50
```

### 5. Test Email Delivery
1. Visit https://awareness.market/auth
2. Click "Forgot Password?"
3. Enter your email
4. Check inbox for verification code
5. Verify code works in reset flow

## Monitoring & Troubleshooting

### Check Email Logs
```bash
# On production server
pm2 logs awareness-market | grep "Email"
```

### Common Issues

#### 1. "API key invalid"
- Verify API key is correct in `.env.production`
- Check if key has proper permissions
- Regenerate key if needed

#### 2. "Domain not verified"
- Complete domain verification in email provider dashboard
- Add all required DNS records
- Wait up to 48 hours for DNS propagation

#### 3. "Emails going to spam"
- Verify domain authentication (SPF, DKIM, DMARC)
- Use a professional sender address (noreply@awareness.market)
- Avoid spam trigger words in subject/body

#### 4. "Rate limit exceeded"
- Check your plan limits
- Implement email queuing for high volume
- Upgrade to paid plan if needed

### Email Deliverability Best Practices

1. **Use Verified Domain:** Always verify your sending domain
2. **Warm Up IP:** Start with low volume, gradually increase
3. **Monitor Bounce Rate:** Keep below 5%
4. **Handle Unsubscribes:** Respect opt-out requests
5. **Authenticate Emails:** Use SPF, DKIM, and DMARC records

## Cost Estimation

### Resend Pricing
- Free: 3,000 emails/month
- Pro: $20/month for 50,000 emails
- Enterprise: Custom pricing

### SendGrid Pricing
- Free: 100 emails/day (3,000/month)
- Essentials: $19.95/month for 50,000 emails
- Pro: $89.95/month for 1.5M emails

### Estimated Usage for Awareness Market
- Password resets: ~50/day
- Welcome emails: ~20/day
- Notifications: ~100/day
- **Total:** ~170 emails/day (~5,000/month)

**Recommendation:** Start with free tier, upgrade when needed.

## Next Steps

1. ✅ Choose email provider (Resend or SendGrid)
2. ✅ Create account and get API key
3. ✅ Configure environment variables
4. ✅ Deploy to production
5. ✅ Test email delivery
6. ✅ Monitor deliverability metrics

## Support

- **Resend Support:** https://resend.com/support
- **SendGrid Support:** https://support.sendgrid.com
- **Awareness Market:** https://awareness.market/about

---

**Ready to send emails?** Choose your provider and follow the steps above! 📧
