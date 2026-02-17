# Architecture

## System Overview

Awareness Network is a full-stack TypeScript application with a React frontend and Node.js backend connected via tRPC for end-to-end type safety.

```
┌─────────────────────────────────────────────────────────┐
│                     Client (React)                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ │
│  │Marketplace│ │Dashboard │ │Robotics  │ │AI Collab   │ │
│  └─────┬─────┘ └─────┬────┘ └─────┬────┘ └─────┬──────┘ │
│        └──────────────┴───────────┴─────────────┘        │
│                        tRPC Client                        │
└────────────────────────┬──────────────────────────────────┘
                         │ HTTPS
┌────────────────────────┴──────────────────────────────────┐
│                    Server (Node.js)                        │
│  ┌────────────┐ ┌───────────┐ ┌──────────┐ ┌───────────┐ │
│  │ tRPC Router│ │ Auth      │ │ MCP      │ │ WebMCP    │ │
│  └──────┬─────┘ └─────┬─────┘ └────┬─────┘ └─────┬─────┘ │
│         └──────────────┴────────────┴─────────────┘       │
│  ┌──────────────────────────────────────────────────────┐ │
│  │              Robotics Middleware (RMC)                │ │
│  │  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌────────────┐ │ │
│  │  │ROS2     │ │Multi-Robot│ │VR      │ │Health      │ │ │
│  │  │Bridge   │ │Coordinator│ │Control │ │Check       │ │ │
│  │  └─────────┘ └──────────┘ └────────┘ └────────────┘ │ │
│  └──────────────────────────────────────────────────────┘ │
└────────────────────────┬──────────────────────────────────┘
                         │
┌────────────────────────┴──────────────────────────────────┐
│                   Infrastructure                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐ │
│  │PostgreSQL│  │  Redis   │  │ BullMQ   │  │Prometheus │ │
│  │(Prisma)  │  │ (Cache)  │  │ (Queues) │  │(Metrics)  │ │
│  └──────────┘  └──────────┘  └──────────┘  └───────────┘ │
└───────────────────────────────────────────────────────────┘
```

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Tailwind CSS, Wouter |
| API | tRPC (end-to-end type-safe) |
| Backend | Node.js, Express |
| Database | PostgreSQL via Prisma ORM |
| Cache | Redis (robotics: 125x speedup) |
| Task Queue | BullMQ (async robot tasks) |
| Auth | Session-based + MCP token + ERC-8004 |
| VR | WebXR API + WebRTC |
| Monitoring | Prometheus metrics |
| 3D Animation | Unicorn Studio |

## Key Design Decisions

### End-to-End Type Safety
All API calls use tRPC, meaning the client and server share TypeScript types. No code generation, no runtime type mismatches.

### Glassmorphism UI
The frontend uses a consistent dark theme with glass-morphism cards (`backdrop-blur`, `bg-white/[0.06]`, `border-white/[0.1]`), Aeonik font, and Unicorn Studio 3D backgrounds.

### Robotics as a First-Class Product
RMC (Robotics Middleware Controller) is not an afterthought — it has its own Redis cache layer, BullMQ task queue, health monitoring, and dedicated tRPC router with 20+ endpoints.
