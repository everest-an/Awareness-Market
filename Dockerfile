# Backend Dockerfile for Railway deployment
FROM node:22-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@10.4.1

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches

# Copy source code
COPY server ./server
COPY drizzle ./drizzle
COPY shared ./shared

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build TypeScript
RUN pnpm build:server || echo "No build script, using tsx"

# Expose port
EXPOSE 3000

# Start server
CMD ["pnpm", "start:server"]
