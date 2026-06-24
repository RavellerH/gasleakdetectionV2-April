# 🔥 Gas Leak Detection System — v0.15

> **AI-powered multi-refinery gas leak monitoring platform** for oil & gas refineries (RU2–RU7).
> Real-time sensor dashboard · Interactive map · Network topology · Event log · Analytics

![Node.js](https://img.shields.io/badge/Node.js-LTS-339933?logo=node.js&logoColor=white)
![NestJS](https://img.shields.io/badge/Backend-NestJS-E0234E?logo=nestjs&logoColor=white)
![Next.js](https://img.shields.io/badge/Frontend-Next.js%2015-000000?logo=next.js&logoColor=white)
![SQLite](https://img.shields.io/badge/Database-SQLite-003B57?logo=sqlite&logoColor=white)

---

## Overview

A full-stack IoT monitoring platform that aggregates gas sensor data from edge firmware nodes across 6 oil & gas refinery units. The system uses an on-device AI model to classify gas leak events in real time — replacing raw PPM readings with actionable `confidence`, `aiClass`, and `riskLevel` metrics surfaced directly in the dashboard.

**Key capabilities:**
- 🗺️ **Interactive map** — live sensor positions plotted per refinery unit (Mapbox GL JS)
- 📊 **Real-time dashboard** — risk-level indicators, trend charts, and event timeline
- 🔗 **Network topology view** — visualize edge node connectivity
- 📋 **Event log** — filterable history of detected leak events with AI classification
- 🤖 **AI inference** — edge-side confidence scoring and risk classification (no raw PPM)
- 🔐 **Auth** — role-based access, default admin account for demo

---

## Quick Start

### Requirements
- Nothing to install beforehand — the script below installs Node.js for you if it's missing.
- No database, no Docker, no other installs needed.

### Run the app

**Windows:**
1. Download / clone this repository
2. **Double-click `start.bat`**
3. Wait for the setup to finish (first run: ~2 minutes)
4. Open your browser at **http://localhost:3000**

**Mac / Linux:**
1. Download / clone this repository
2. Open a terminal in the project folder and run `./start.sh`
3. Wait for the setup to finish (first run: ~2 minutes)
4. Open your browser at **http://localhost:3000**

Run the same script again any time to restart — it checks for updates first, then skips setup and launches straight away. The script also checks your internet connection, PC specs, and installs Node.js automatically if it isn't already on your machine (you'll see your OS's normal permission prompt — that's expected). See the [Usage Guide](./Documentation/Usage-Guide.md) for details.

```
Login:    admin@gld.com
Password: admin
```

> `start.bat` handles everything automatically:  
> installs packages → creates config → sets up database → loads demo data → starts servers

---

## Tech Stack

| Layer | Stack |
|-------|-------|
| Backend API | Node.js · NestJS · GraphQL · Prisma ORM |
| Database | SQLite (file-based, zero install) |
| Frontend | Next.js 15 · Mapbox GL JS · Recharts |
| Edge Firmware | C++ (ESP32 / embedded) |
| AI / Inference | On-device classification → `aiClass`, `confidence`, `riskLevel` |
| Map | Mapbox (50,000 free tile loads/month) |

---

## Refinery Units Covered

| Unit | Location |
|------|----------|
| RU2 | Dumai, Riau |
| RU3 | Plaju, Palembang |
| RU4 | Cilacap, Central Java |
| RU5 | Balikpapan, East Kalimantan |
| RU6 | Balongan, Indramayu |
| RU7 | Kasim, Sorong Regency |

---

## Monorepo Structure

```
apps/
  backend/         NestJS GraphQL API       (port 4000)
  frontend/        Next.js dashboard        (port 3000)
edge firmware/
  src/             C++ firmware for ESP32 edge nodes
Documentation/     Design docs and study notes
memory/            Project context / agent memory notes
presentation/      Slide deck assets
```

---

## Stopping the App

Press **Ctrl+C** in the terminal window that opened, or simply close it.

## Restarting After First Setup

Double-click `start.bat` again — it skips the first-time setup and goes straight to launching.

---

## Manual Dev Commands (Optional)

```bash
npm install           # install all dependencies
npm run dev           # start both servers together
npm run dev:backend   # backend only
npm run dev:frontend  # frontend only
```

To reset demo data:
```bash
cd apps/backend
node prisma/seed.js
```

---

## License

Internal / research project — Pertamina refinery monitoring use case.
