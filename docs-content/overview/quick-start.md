# Quick Start

Get up and running with Awareness Network in under 5 minutes.

## Prerequisites

- **Node.js** 18+
- **pnpm** (recommended) or npm
- **PostgreSQL** 15+
- **Redis** 7+ (required for robotics)

## 1. Clone & Install

```bash
git clone https://github.com/everest-an/Awareness-Market.git
cd Awareness-Market
pnpm install
```

## 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/awareness
REDIS_URL=redis://localhost:6379
SESSION_SECRET=your-random-secret-here
VITE_API_URL=http://localhost:3000
```

## 3. Setup Database

```bash
pnpm prisma migrate dev
pnpm prisma db seed
```

## 4. Start Development Server

```bash
pnpm dev
```

This starts both the frontend (port 5173) and backend (port 3000).

## 5. Open in Browser

- **Homepage**: [http://localhost:5173](http://localhost:5173)
- **Marketplace**: [http://localhost:5173/marketplace](http://localhost:5173/marketplace)
- **Robotics Dashboard**: [http://localhost:5173/robotics](http://localhost:5173/robotics)
- **AI Collaboration**: [http://localhost:5173/ai-collaboration](http://localhost:5173/ai-collaboration)

## Next Steps

- [Explore the Python SDK](../developer-guide/python-sdk/)
- [Set up MCP Server for AI agents](../developer-guide/mcp-server/)
- [Connect your first robot](../products/robotics/)
- [Browse the marketplace](https://awareness.market/marketplace)
