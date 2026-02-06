# Awareness Market Deployment Guide

This guide covers how to deploy the Awareness Market platform to production.

## Prerequisites

- **Node.js**: v20 or higher
- **Database**: MySQL 8.0+ (or compatible like PlanetScale/MariaDB)
- **Object Storage**: AWS S3 or compatible (MinIO, R2)
- **Stripe Account**: For payment processing
- **SMTP Server**: For email notifications

## Environment Variables

Ensure the following environment variables are set in your production environment:

```env
# Application
NODE_ENV=production
PORT=3000
VITE_APP_ID=awareness-market
JWT_SECRET=your-secure-random-secret

# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Authentication
OAUTH_SERVER_URL=https://auth.example.com
OWNER_OPEN_ID=admin_openid_identifier

# AWS S3 (Vector Storage)
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
AWS_BUCKET_NAME=awareness-vectors

# Stripe (Payments)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email (SMTP)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your_smtp_password
SMTP_FROM=noreply@awareness.market

# Integration (Optional)
BUILT_IN_FORGE_API_URL=https://api.manus.im
BUILT_IN_FORGE_API_KEY=your_forge_key
```

## Build and Run

1. **Install Dependencies**:

    ```bash
    npm install --omit=dev
    ```

2. **Build the Application**:

    ```bash
    npm run build
    ```

    This compiles the frontend (Vite) and backend (esbuild) into the `dist/` directory.

3. **Run Database Migrations**:

    ```bash
    pnpm prisma migrate deploy
    ```

4. **Start the Server**:

    ```bash
    npm start
    ```

## Docker Deployment

A `Dockerfile` is provided for containerized deployment.

```bash
# Build image
docker build -t awareness-market .

# Run container
docker run -p 3000:3000 --env-file .env awareness-market
```

## LatentMAS Configuration

For optimal performance with the LatentMAS protocol:

- Ensure your server has sufficient RAM to handle vector manipulations in memory.
- If using `learned` alignment, consider deploying a separate Python microservice for heavy matrix operations.
