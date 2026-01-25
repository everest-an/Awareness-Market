#!/bin/bash

# AWS Deployment Script for Awareness Marketplace
set -e

echo "=== Awareness AWS Deployment Script ==="

# Install dependencies
echo "Installing dependencies..."
pnpm install

# Build the application
echo "Building application..."
pnpm build

# Run database migrations
echo "Running database migrations..."
pnpm db:push

# Start with PM2
echo "Starting application with PM2..."
pm2 delete awareness 2>/dev/null || true
pm2 start dist/server/index.js --name awareness --env production

# Save PM2 config
pm2 save

# Setup PM2 startup
pm2 startup

echo "=== Deployment Complete ==="
echo "Application is running on port 3000"
