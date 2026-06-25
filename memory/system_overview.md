# System Overview

## Purpose
Industrial gas leak detection across 6 Pertamina refinery units (RU2–RU7) using AI-based classification on edge hardware.

## Hardware Distribution (from Gas-Leak-Design-v2.1.md)

| RU | Cluster Heads | Gateways | Sensor Nodes | Thermal Cameras | Total |
|----|--------------|----------|--------------|-----------------|-------|
| RU2 | 3 | 1 | 10 | 1 | 15 |
| RU3 | 3 | 1 | 4 | 1 | 9 |
| RU4 | 2 | 1 | 3 | 1 | 7 |
| RU5 | 3 | 1 | 2 | 1 | 7 |
| RU6 | 2 | 2 | 4 | 1 | 9 |
| RU7 | 11 | 1 | 5 | 1 | 18 |
| **Total** | **24** | **8** | **28** | **7** | **65** |

## Full Hardware → Software Chain

> Updated 2026-06-25 to match the real firmware repo (`fadlurrahmanf/PertaminaGLD`) — see `pertamina_gld_protocol.md` for byte-level detail. This replaces the previous (speculative) chain below it.

```
GLD Sensor Node (ESP32-S3)
  Sensors → on-device inference → gasClass (0–6) + confidence (0–100) + batteryMv
  → encrypted (AES-128-GCM) into GLDRecord payload → LoRa STAR to CH
        ↓
Cluster Head / CH (ESP32-S3, dual radio, mesh)
  Relays GLDRecord toward Gateway (does not decrypt)
        ↓ LoRa MESH, possibly multi-hop (CH-CH multi-hop still draft upstream)
Gateway (ESP32-S3 + WiFi/MQTT)
  Publishes JSON-wrapped encrypted frame hex — does not decrypt
  Topics: gld/gateway/uplink, gld/gateway/status
        ↓
Node-RED + embedded Aedes broker  (per-RU local server, decode/decrypt bridge)
  AES-128-GCM decrypt + AppFrame/GLDRecord parse + validate
  Topics out: gld/server/decoded, gld/server/alarm, gld/gateway/error
        ↓
NestJS Backend (port 4000) — MQTT subscriber + GraphQL API
        ↓ Prisma ORM, gated by Device.commissioningStatus
SQLite (prisma/dev.db)
        ↓ polling
Next.js Frontend (port 3000)
```

## Confirmed Integration Decisions

| Decision | Answer |
|---|---|
| Sensor data unit | AI classification: `gasClass` (0–6) + `confidence` (0–100) + `riskLevel` (LOW/MIDDLE/HIGH derived server-side); no PPM |
| Node identity | nodeId (uint16) stored as hex string in `macAddress`, e.g. `"0xF001"` |
| Wire protocol | **PertaminaGLD's `GLDRecord`/AppFrame contract** (AES-128-GCM encrypted) — authoritative, see `pertamina_gld_protocol.md` |
| Gateway → Server transport | MQTT broker, **encrypted end-to-end until Node-RED** (Gateway never decrypts) |
| Decode/decrypt location | **Node-RED**, per RU, alongside NestJS — not ported into NestJS |
| Database strategy | SQLite only — no MySQL staging (dropped; Node-RED publishes decoded JSON directly back onto MQTT) |
| Node-RED role | AES-GCM decode/decrypt bridge, reusing PertaminaGLD's own flow as the starting point |
| Device registration | **Auto-create, gated** — unknown nodeId creates a `Device` row in `commissioningStatus: 'DISCOVERED'`; readings stored but excluded from alarms until a technician commissions it. See `commissioning_mode.md`. |
| Deployment topology | One local server (this stack) per RU, on-prem — see `commissioning_mode.md` for the first-installation flow |

## Planned Production Upgrade (from Architecture.md)
- Database: SQLite (dev) → **TimescaleDB/PostgreSQL** (production)
- Real-time: polling → **GraphQL Subscriptions / WebSocket**
- Auth: none (dev) → **Keycloak JWT + RU tenant guard**

## Software Stack

| Layer | Current | Planned |
|---|---|---|
| Backend | NestJS 10, GraphQL, Prisma, SQLite | + MQTT module, TimescaleDB |
| Frontend | Next.js 15, Mapbox GL, Recharts, Tailwind | + Socket.io, WebPush |
| Auth | None (email-only) | Keycloak |
| Infra | Docker Compose (dev) | Kubernetes + Helm |
