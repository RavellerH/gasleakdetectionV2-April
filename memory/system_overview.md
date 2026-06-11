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

```
GLD Sensor Node (ESP32-S3)
  8x MQ sensors → ADS1256 ADC → AGC → TFLite Micro inference
  → predicted_class (0–8) + confidence (0.0–1.0)
  → AppFrame SENSOR_DATA  [LoRa STAR, 920 MHz, SF7]
        ↓
Cluster Head / CH (ESP32-S3, dual SX1262)
  Radio A = STAR (920 MHz SF7) ← receives GLD
  Radio B = MESH (921 MHz SF9) → sends to Gateway
  Buffers normal data; pushes alarm immediately
        ↓ multi-hop tree: CH → CH → Gateway
Gateway (single LoRa + WiFi/Ethernet)
  Publishes binary AppFrame to MQTT broker
        ↓
MQTT Broker (mosquitto)
  Topic: gld/gw/{gatewayId}/up  ← uplink
  Topic: gld/gw/{gatewayId}/dn  → downlink
        ↓
NestJS Backend (port 4000) — GraphQL API
        ↓ Prisma ORM
SQLite (prisma/dev.db)
        ↓ polling
Next.js Frontend (port 3000)
```

## Confirmed Integration Decisions

| Decision | Answer |
|---|---|
| Sensor data unit | AI risk level: **LOW / MIDDLE / HIGH** (no PPM) |
| Node identity | nodeId (uint16) stored as hex string in `macAddress`, e.g. `"0x0005"` |
| Gateway → Server transport | **MQTT broker** |
| Database strategy | **Hybrid** — SQLite for app logic, MySQL for Node-RED ingestion staging |
| Node-RED role | Aggregator of mixed sources (MQTT, HTTP, Serial) → MySQL staging → backend polls MySQL |
| Device registration | Not yet decided: skip unknown nodeId OR auto-create |

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
