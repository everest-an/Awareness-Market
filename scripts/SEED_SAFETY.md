# 🛡️ Database Seed Script - Safety Guidelines

## ⚠️ CRITICAL WARNING

The seed script (`scripts/seed.ts`) contains **DESTRUCTIVE operations** that can permanently delete all marketplace data. This document outlines safety measures and proper usage.

---

## 🚨 NEVER Run These Commands in Production

```bash
# ❌ DANGEROUS - Will delete all data:
npm run seed:clean

# ❌ DANGEROUS - May delete data if --clean flag is used:
npm run seed -- --clean
```

**These commands will DELETE:**
- All vector packages (`vector_packages`)
- All memory packages (`memory_packages`)
- All chain packages (`chain_packages`)
- All user data (`users`)
- All transactions (`transactions`)
- All reviews (`reviews`)
- And more...

---

## ✅ Safe Usage

### Development Environment Only

The seed script is **ONLY for development and testing**. Production safety checks will:
- Block execution if `NODE_ENV=production`
- Block execution if database URL contains `prod`, `production`, `live`, or `main`
- Show a 3-second countdown with warnings before cleanup
- Display which tables will be affected

### Recommended Workflow

1. **Check your environment:**
   ```bash
   echo $NODE_ENV
   echo $DATABASE_URL
   ```

2. **Ensure you're in development mode:**
   ```bash
   export NODE_ENV=development  # or add to .env file
   ```

3. **Use non-destructive seeding (recommended):**
   ```bash
   npm run seed              # Add sample data WITHOUT cleaning
   npm run seed:vectors      # Add only vector samples
   npm run seed:packages     # Add only package samples
   ```

4. **Only use cleanup when necessary:**
   ```bash
   npm run seed:clean        # ⚠️ DESTRUCTIVE - Cleans then seeds
   ```

---

## 🔒 Production Safeguards Implemented

### 1. Environment Checks
```typescript
if (nodeEnv === 'production') {
  console.error('Cannot clean database in production');
  process.exit(1);
}
```

### 2. Database Name Validation
Blocks cleanup if database URL contains:
- `prod` or `production`
- `live` or `main`

Example blocked URLs:
- `mysql://root@localhost:3306/awareness_market_prod` ❌
- `mysql://root@localhost:3306/production_db` ❌
- `mysql://root@live-server:3306/awareness` ❌

### 3. Countdown Warning
When `--clean` is used, you get:
- A list of all tables that will be cleared
- Database URL display
- 3-second countdown to cancel (Ctrl+C)

---

## 📊 What the Seed Script Does

### Sample Data Created

**Users (5):**
- 3 creators (Alice, Bob, AI Agent Alpha)
- 2 consumers (Carol, David)

**Latent Vectors (12):**
- Smart contract optimization vectors
- Medical AI vectors
- Legal reasoning vectors
- And more...

**Packages (30 total):**
- 10 vector packages (.vectorpkg)
- 10 memory packages (.memorypkg)
- 10 reasoning chain packages (.chainpkg)

### Files Modified

The script interacts with these database tables:
- `users` - User accounts
- `latent_vectors` - Base vector listings
- `vector_packages` - Vector marketplace products
- `memory_packages` - Memory marketplace products
- `chain_packages` - Chain marketplace products
- `transactions` - Purchase records
- `access_permissions` - Vector access control
- `reviews` - Product reviews
- `api_call_logs` - Usage tracking
- `package_purchases` - Package purchase records
- `package_downloads` - Download tracking

---

## 🔧 Troubleshooting

### "Cannot clean database in production"
**Cause:** `NODE_ENV` is set to `production`
**Fix:** Change to development mode:
```bash
export NODE_ENV=development
```

### "Database URL contains 'prod'"
**Cause:** Your database URL appears to be a production database
**Fix:** Use a development database URL in `.env`:
```
DATABASE_URL=mysql://root@localhost:3306/awareness_market_dev
```

### "Database not available"
**Cause:** MySQL server is not running or credentials are incorrect
**Fix:**
1. Start MySQL: `brew services start mysql` (macOS) or `sudo service mysql start` (Linux)
2. Verify credentials in `.env` file
3. Test connection: `mysql -u root -p`

---

## 📖 Related Documentation

- **Database Schema:** `drizzle/schema.ts`
- **Migration Files:** `drizzle/migrations/`
- **Environment Config:** `.env.example`
- **Main Seed Script:** `scripts/seed.ts`

---

## 🆘 Emergency Recovery

If data was accidentally deleted:

### 1. Database Backups
Restore from your latest MySQL backup:
```bash
mysql -u root -p awareness_market < backup.sql
```

### 2. Re-seed Development Data
```bash
npm run seed
```

### 3. Production Data
If this happened in production (should be impossible due to safeguards):
1. Immediately stop the application
2. Contact your database administrator
3. Restore from automated backups (RDS, managed MySQL, etc.)
4. Review incident logs
5. Update access controls

---

## ✅ Best Practices

1. **Never commit production `.env` files**
2. **Always verify `NODE_ENV` before running seed scripts**
3. **Use separate databases for dev/staging/prod**
4. **Enable automated backups in production**
5. **Restrict seed script execution to local development**
6. **Review database URL before any destructive operation**
7. **Use database connection aliases** (dev-db, prod-db) to prevent mistakes

---

## 🔐 Access Control Recommendations

### Development Team
- **Full access** to development databases
- **Read-only access** to staging databases
- **No direct access** to production databases

### CI/CD Pipelines
- **Never run seed scripts** in CI/CD for staging/production
- Use proper migration tools (`drizzle-kit migrate`) instead

### Production Deployments
- Remove or restrict execution permissions on `scripts/seed.ts`
- Use environment-specific startup commands
- Implement database backup verification before any schema changes

---

## 📞 Support

If you encounter issues or need to perform database operations in production:

1. Open an issue in the repository
2. Contact the database administrator
3. Review the architecture documentation in `docs/ARCHITECTURE.md`

**Remember:** When in doubt, **DO NOT run the seed script**. It's safer to manually add test data than to accidentally wipe production data.
