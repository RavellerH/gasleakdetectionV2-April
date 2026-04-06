## Gas Leak Detector Monitoring Platform

This repository contains a **multi-RU gas leak detector monitoring platform** based on `Gas-Leak-Design-v2.1.md`.

The app is structured as a small monorepo:

- `apps/backend`: Nest-style GraphQL API with Prisma data model for devices, users, and health metrics
- `apps/frontend`: Next.js app with RU-aware dashboards, maps, and device management UI

### Tech Stack (Planned)

- **Backend**: Node.js, Nest-style modules, GraphQL (code-first), Prisma ORM (Timescale/PostgreSQL)
- **Frontend**: Next.js (App Router), Shadcn/UI, Mapbox GL JS
- **Infra**: Docker Compose for local dev (backend, frontend, db, redis)

### Development

Install dependencies from the repo root:

```bash
npm install
```

Then run backend and frontend together:

```bash
npm run dev
```

Or individually:

```bash
npm run dev:backend
npm run dev:frontend
```

> NOTE: The codebase is scaffolded to follow the architecture in `Gas-Leak-Design-v2.1.md`. Many advanced features (MQTT, Kafka, thermal camera, full RBAC, etc.) are left as future work.

