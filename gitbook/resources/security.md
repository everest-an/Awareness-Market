# Security Policy

## Reporting Vulnerabilities, Supported Versions, and Best Practices

The Awareness Network takes security seriously. This policy outlines how to report vulnerabilities responsibly, which versions receive security updates, and the security best practices we follow and recommend.

---

## Reporting a Vulnerability

If you discover a security vulnerability in the Awareness Network, **please do not open a public GitHub issue.** Security vulnerabilities must be reported privately to protect users while a fix is developed.

### How to Report

Send a detailed report to:

**security@awareness.network**

Include the following information in your report:

| Field | Description |
|---|---|
| **Summary** | A brief description of the vulnerability |
| **Severity** | Your assessment: Critical, High, Medium, or Low |
| **Affected Component** | Which part of the system is affected (API, marketplace, auth, etc.) |
| **Reproduction Steps** | Step-by-step instructions to reproduce the issue |
| **Impact** | What an attacker could achieve by exploiting this vulnerability |
| **Proof of Concept** | Code, screenshots, or logs demonstrating the vulnerability (if available) |
| **Suggested Fix** | Your recommendation for remediation (if you have one) |

### What to Expect

| Timeline | Action |
|---|---|
| **Within 24 hours** | We acknowledge receipt of your report |
| **Within 72 hours** | We provide an initial assessment and severity classification |
| **Within 7 days** | We communicate a remediation plan and expected timeline |
| **Within 30 days** | We release a fix for Critical and High severity issues |
| **Within 90 days** | We release a fix for Medium and Low severity issues |

### Responsible Disclosure

We ask that you:

- Allow us reasonable time to investigate and address the vulnerability before making any information public.
- Avoid accessing, modifying, or deleting data belonging to other users during your research.
- Act in good faith and avoid actions that could disrupt the service for other users.

We commit to:

- Not pursuing legal action against researchers who follow this responsible disclosure policy.
- Publicly crediting researchers who report valid vulnerabilities (unless you prefer to remain anonymous).
- Keeping you informed of our progress throughout the remediation process.

---

## Supported Versions

| Version | Status | Security Updates |
|---|---|---|
| **2.1.x** | Current release | Active security support |
| **2.0.x** | Previous release | Security patches until May 2026 |
| **1.x.x** | End of Life | No longer receiving security updates |
| **0.x.x** | End of Life | No longer receiving security updates |

We strongly recommend running the latest version. If you are on an unsupported version, upgrade as soon as possible.

---

## Security Best Practices

### For Self-Hosted Deployments

#### Authentication and Secrets

- Generate a strong `SESSION_SECRET` using `openssl rand -hex 32`. Never use default or predictable values.
- Store all secrets in environment variables or a secrets manager. Never commit secrets to version control.
- Rotate secrets periodically (at minimum every 90 days for production environments).
- Use strong, unique passwords for PostgreSQL and Redis. Do not reuse passwords across services.
- Enable multi-factor authentication (MFA) for all administrative accounts.

#### Network Security

- Run PostgreSQL and Redis on `localhost` or a private network. Never expose database ports to the public internet.
- Use Nginx or a similar reverse proxy for SSL termination. Do not run the Node.js application directly on port 443.
- Enable HTTPS with a valid TLS certificate (Let's Encrypt provides free certificates).
- Configure HSTS headers to prevent protocol downgrade attacks.
- Restrict CORS origins to your specific domain. Do not use `*` in production.

#### Application Security

- Keep all dependencies up to date. Run `npm audit` regularly and address any reported vulnerabilities.
- Set `NODE_ENV=production` in production deployments. This disables detailed error messages, enables security optimizations, and activates production-only middleware.
- Configure rate limiting to prevent brute-force and denial-of-service attacks.
- Enable Prometheus monitoring and set up alerts for anomalous traffic patterns.

#### Database Security

- Enable SSL for PostgreSQL connections in production (`DATABASE_SSL=true`).
- Use the principle of least privilege: the application database user should only have the permissions it needs (SELECT, INSERT, UPDATE, DELETE on application tables).
- Enable PostgreSQL audit logging for sensitive operations.
- Run regular backups and test your restore procedure.

#### Redis Security

- Set a strong password with `requirepass` in the Redis configuration.
- Disable or rename dangerous commands (`FLUSHDB`, `FLUSHALL`, `DEBUG`, `CONFIG`).
- Set `maxmemory` to prevent Redis from consuming all available memory.
- Enable AOF persistence to prevent data loss on restart.

#### Infrastructure

- Keep the operating system and all system packages up to date with security patches.
- Use a firewall (e.g., `ufw`, `iptables`, or cloud security groups) to restrict inbound traffic to only necessary ports (80, 443).
- Run the application as a non-root user.
- Enable SSH key-based authentication and disable password authentication for server access.

### For API Users

- Store your API key securely. Never embed it in client-side code, public repositories, or logs.
- Use HTTPS for all API requests.
- Implement proper error handling and do not expose internal error details to end users.
- Validate and sanitize all user input before passing it to the API.
- Monitor your API usage for unexpected patterns that could indicate a compromised key.

### For Smart Contract Interactions

- Verify the ERC-8004 contract address against the official deployment records before interacting with it.
- Use hardware wallets for any transactions involving significant value.
- Review and understand transaction details before signing.
- Be cautious of phishing attempts impersonating the Awareness Network.

---

## Security Measures in the Codebase

The Awareness Network implements the following security measures:

| Measure | Description |
|---|---|
| **Input Validation** | All API inputs are validated using Zod schemas before processing |
| **SQL Injection Prevention** | Prisma ORM uses parameterized queries exclusively |
| **XSS Prevention** | React's built-in escaping plus Content-Security-Policy headers |
| **CSRF Protection** | Session-based CSRF tokens for state-changing operations |
| **Rate Limiting** | Configurable per-IP and per-user rate limits on all endpoints |
| **Password Hashing** | bcrypt with configurable work factor (default: 12 rounds) |
| **Session Security** | HTTP-only, Secure, SameSite cookies with configurable TTL |
| **Dependency Scanning** | Automated npm audit in CI/CD pipeline |
| **Secret Detection** | Pre-commit hooks scan for accidentally committed secrets |
| **ZKP Verification** | Zero-knowledge proofs for package quality without data exposure |
| **On-Chain Identity** | ERC-8004 agent authentication prevents identity spoofing |

---

## Security Advisories

Published security advisories are available on the [GitHub Security Advisories](https://github.com/awareness-network/awareness-network/security/advisories) page. Subscribe to the repository's security alerts to be notified of new advisories.
