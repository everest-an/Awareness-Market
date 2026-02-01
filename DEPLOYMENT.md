# Awareness Market Deployment Guide

This guide provides instructions for deploying the Awareness Market application, including both the backend API and the frontend web application.

## Prerequisites

Before you begin, ensure you have the following installed and configured:

- **Node.js** (v20 or later)
- **pnpm** (v10 or later)
- **Vercel CLI** (`npm i -g vercel`)
- **Git**
- **SSH Key** for EC2 access, configured at `~/.ssh/awareness-key.pem`

## Automated Deployment

We have created scripts to automate the deployment process as much as possible.

### One-Click Deployment

This is the recommended method for most deployments.

```bash
# Deploy both frontend and backend
./deploy.sh all

# Deploy only the backend
./deploy.sh backend

# Deploy only the frontend
./deploy.sh frontend
```

### GitHub Actions (CI/CD)

- **Backend**: The backend is automatically deployed to EC2 whenever changes are pushed to the `main` branch in the `server/` or `prisma/` directories.
- **Frontend**: The frontend is automatically deployed to Vercel whenever changes are pushed to the `main` branch in the `client/` directory.

## Manual Deployment

If you need to deploy manually, follow these steps.

### Backend Deployment (to EC2)

1. **Build the backend**:
   ```bash
   pnpm run build:backend
   ```

2. **Upload to EC2**:
   ```bash
   rsync -avz -e "ssh -i ~/.ssh/awareness-key.pem" \
     ./dist/index.js \
     package.json \
     pnpm-lock.yaml \
     ecosystem.config.cjs \
     prisma/ \
     ec2-user@44.220.181.78:/home/ec2-user/Awareness-Market/
   ```

3. **Restart the service on EC2**:
   ```bash
   ssh -i ~/.ssh/awareness-key.pem ec2-user@44.220.181.78 <<-\'EOF\'
     cd /home/ec2-user/Awareness-Market
     pnpm install --prod
     npx prisma generate
     pm2 restart ecosystem.config.cjs
   EOF
   ```

### Frontend Deployment (to Vercel)

1. **Build the frontend**:
   ```bash
   pnpm run build:frontend
   ```

2. **Deploy to Vercel**:
   ```bash
   vercel --prod
   ```

## Configuration

### Backend (EC2)

- **PM2 Config**: `ecosystem.config.cjs`
- **Environment**: Handled by PM2 config

### Frontend (Vercel)

- **Vercel Config**: `vercel.json`
- **Environment Variables**: `.env.production`
  - `VITE_API_URL`: The public URL of the backend API (e.g., `http://44.220.181.78:3001`)

## Troubleshooting

- **Backend**: Check PM2 logs on the EC2 instance:
  ```bash
  ssh -i ~/.ssh/awareness-key.pem ec2-user@44.220.181.78 "pm2 logs"
  ```

- **Frontend**: Check the Vercel deployment logs in the Vercel dashboard.

- **Build Issues**: If you encounter build issues, try cleaning the cache and reinstalling dependencies:
  ```bash
  rm -rf node_modules dist .turbo
  pnpm install
  ```
