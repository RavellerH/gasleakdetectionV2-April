# Gas Leak Detection System — v0.15

Multi-RU gas leak monitoring platform for Pertamina refineries (RU2–RU7).  
Real-time sensor dashboard · Interactive map · Network topology · Event log · Analytics

---

## Quick Start (Windows)

### Requirements
- **Node.js LTS** — download from [https://nodejs.org](https://nodejs.org) (click the LTS button, run the installer, keep all defaults)
- That's it. No database, no Docker, no other installs needed.

### Run the app

1. Download / clone this repository
2. **Double-click `start.bat`**
3. Wait for the setup to finish (first run: ~2 minutes)
4. Open your browser at **http://localhost:3000**

```
Login:    admin@gld.com
Password: admin
```

> `start.bat` handles everything automatically:  
> installs packages → creates config → sets up database → loads demo data → starts servers

---

## What's inside

| Area | Stack |
|------|-------|
| Backend API | Node.js · NestJS · GraphQL · Prisma ORM |
| Database | SQLite (file-based, no install needed) |
| Frontend | Next.js 15 · Mapbox GL JS · Recharts |
| Map | Mapbox (50,000 free map loads/month) |

### Refinery Units covered
| Unit | Location |
|------|----------|
| RU2 | Dumai, Riau |
| RU3 | Plaju, Palembang |
| RU4 | Cilacap, Central Java |
| RU5 | Balikpapan, East Kalimantan |
| RU6 | Balongan, Indramayu |
| RU7 | Kasim, Sorong Regency |

---

## Stopping the app

Press **Ctrl+C** in the terminal window that opened, or simply close it.

## Restarting after the first setup

Double-click `start.bat` again — it skips the first-time setup steps and goes straight to launching.

---

## Monorepo structure

```
apps/
  backend/   NestJS GraphQL API  (port 4000)
  frontend/  Next.js dashboard   (port 3000)
```

## Manual dev commands (optional)

```bash
npm install          # install all dependencies
npm run dev          # start both servers together
npm run dev:backend  # backend only
npm run dev:frontend # frontend only
```

To reset demo data:
```bash
cd apps/backend
node prisma/seed.js
```
