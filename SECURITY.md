# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 1.x     | Yes       |

## Reporting a Vulnerability

If you discover a security vulnerability in Awareness Market, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

### How to Report

1. Email: **security@awareness.market**
2. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- **Acknowledgment** within 48 hours
- **Initial assessment** within 5 business days
- **Resolution timeline** communicated after assessment
- **Credit** in the security advisory (unless you prefer anonymity)

### Scope

The following are in scope for security reports:

- Authentication and authorization bypasses
- SQL injection, XSS, CSRF, and other OWASP Top 10 vulnerabilities
- Cryptographic weaknesses (key handling, encryption)
- Private key or credential exposure
- Privilege escalation
- Data leakage between tenants/users

### Out of Scope

- Denial of service (DoS) attacks
- Social engineering
- Issues in dependencies (report these upstream)
- Issues requiring physical access

## Security Practices

- All secrets are stored as environment variables, never in code
- Wallet private keys are encrypted with AES-256-GCM before database storage
- JWT tokens expire after 1 hour; refresh tokens after 7 days
- Rate limiting is applied to all authentication endpoints
- All user input is validated with Zod schemas at the API boundary
- BYOK (Bring Your Own Key) API keys are stored encrypted with per-key salts
