# Gas Leak Detector Monitoring Platform

A **multi-RU gas leak detector monitoring platform** based on the architecture defined in `Gas-Leak-Design-v2.1.md`.

This platform enables real-time monitoring of gas leak detectors across multiple Regional Units (RUs), with dashboards, alerts, and device management capabilities.

## 📁 Project Structure

This repository is structured as a monorepo:

```
gas-leak-monorepo/
├── apps/
│   ├── backend/          # NestJS GraphQL API with Prisma ORM
│   └── frontend/         # Next.js dashboard with RU-aware UI
├── Documentation/        # Additional documentation
├── docker-compose.dev.yml # Docker Compose for local development
├── simulate-sensors.js   # Sensor simulation script
└── cleanup-dummy.js      # Cleanup utility script
```

### Backend (`apps/backend`)

- **Framework**: NestJS-style modular architecture
- **API**: GraphQL (code-first approach)
- **Database**: PostgreSQL with TimescaleDB extension (via Prisma ORM)
- **Features**: Device management, user authentication, health metrics tracking

### Frontend (`apps/frontend`)

- **Framework**: Next.js (App Router)
- **UI Components**: Shadcn/UI
- **Mapping**: Mapbox GL JS for geographic visualization
- **Features**: RU-aware dashboards, interactive maps, device management UI

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | Node.js, NestJS, GraphQL, Prisma ORM |
| **Database** | PostgreSQL 16 + TimescaleDB |
| **Frontend** | Next.js 14+, React, TypeScript |
| **UI** | Shadcn/UI, Tailwind CSS |
| **Maps** | Mapbox GL JS |
| **Cache** | Redis |
| **DevOps** | Docker, Docker Compose |

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or pnpm
- Docker & Docker Compose (for containerized development)

### Installation

1. **Clone the repository** (if not already done)

2. **Install dependencies** from the repo root:
   ```bash
   npm install
   ```

### Development

#### Option 1: Run with Docker Compose (Recommended)

```bash
docker-compose -f docker-compose.dev.yml up --build
```

This will start:
- **Frontend**: http://localhost:3000
- **Backend GraphQL API**: http://localhost:3001/graphql
- **PostgreSQL Database**: localhost:5432
- **Redis**: localhost:6379

#### Option 2: Run Locally

Run both backend and frontend together:
```bash
npm run dev
```

Or run them individually:
```bash
# Terminal 1 - Backend
npm run dev:backend

# Terminal 2 - Frontend
npm run dev:frontend
```

## 📜 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Run both backend and frontend in development mode |
| `npm run dev:backend` | Run only the backend server |
| `npm run dev:frontend` | Run only the frontend application |

## 🔧 Configuration

### Environment Variables

**Backend** (`apps/backend/.env`):
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/gasleak
```

**Frontend** (`apps/frontend/.env.local`):
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/graphql
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token_here
```

Copy the example files:
```bash
cp apps/frontend/.env.example apps/frontend/.env.local
```

## 🧪 Testing & Utilities

- **Sensor Simulation**: `node simulate-sensors.js` - Simulates gas leak sensor data
- **Cleanup Utility**: `node cleanup-dummy.js` - Cleans up dummy/test data
- **Database Check**: `cd apps/backend && node check-db.js` - Verifies database connection
- **Login Test**: `cd apps/backend && node test-login.js` - Tests authentication flow

## 📝 Design Documentation

Refer to [`Gas-Leak-Design-v2.1.md`](./Gas-Leak-Design-v2.1.md) for detailed architecture specifications, including:

- System architecture overview
- Data models and schema
- API design
- MQTT integration (planned)
- Thermal camera support (planned)
- Role-Based Access Control (RBAC)

## ⚠️ Current Status

This codebase is a **scaffolded implementation** following the architecture in `Gas-Leak-Design-v2.1.md`. 

**Implemented:**
- ✅ Basic project structure
- ✅ Backend GraphQL API setup
- ✅ Frontend Next.js application
- ✅ Docker Compose configuration
- ✅ Prisma database schema

**Future Work:**
- 🔄 MQTT integration for real-time sensor data
- 🔄 Kafka stream processing
- 🔄 Thermal camera integration
- 🔄 Full RBAC implementation
- 🔄 Advanced alerting system
- 🔄 Multi-RU federation features

## 🐳 Docker

Build and run the entire stack:

```bash
docker-compose -f docker-compose.dev.yml build
docker-compose -f docker-compose.dev.yml up
```

Stop all services:
```bash
docker-compose -f docker-compose.dev.yml down
```

Stop and remove volumes:
```bash
docker-compose -f docker-compose.dev.yml down -v
```

## 📄 License

[Specify your license here]

## 👥 Contributing

[Add contribution guidelines if applicable]

---

**Note**: For production deployments, ensure proper security configurations, environment variable management, and infrastructure scaling are implemented.
