# Backend Architecture

**Location:** `apps/backend/src/`
**Port:** 4000
**Entry:** `apps/backend/src/main.ts`

## Module Structure

```
AppModule
  └─ DeviceModule
       ├─ DeviceResolver     (12 GraphQL queries/mutations)
       ├─ UserResolver       (8 GraphQL queries/mutations)
       ├─ DeviceService      (21 business logic methods)
       └─ PrismaService      (singleton DB client)
```

## GraphQL Operations

### Sensor Ingestion (only current entry point)
```graphql
mutation { addReading(macAddress: "0x0005", ppm: 42.5) { id ppm timestamp } }
```

### Dashboard / Analytics
- `getDashboardStats()` — per-RU stats, alerts, battery/network distribution
- `getAnalytics(ruId?, hours?)` — trends, heatmap, fleet health
- `sensorTimeline(ruId!)` — hourly average PPM

### Events & Users
- `eventLogs(ruId?, limit?)`, `acknowledgeEvent(...)`, `createEventLog(...)`
- `users()`, `login(email)`, `createUser(...)`, `deleteUser(...)`

### Devices
- `devices(ruId!)`, `createDevice(...)`, `updateDeviceLocation(...)`, `updateDeviceName(...)`
- `getSettings()`, `updateSettings(...)`

## Prisma Schema (SQLite, `prisma/dev.db`)

```prisma
model User         { id, email (unique), name, ruId, role, devices[], createdAt }
model Device       { id, macAddress (unique), name, deviceType, ruId,
                     location (JSON), batteryStats (JSON), networkStats (JSON),
                     healthScore, status, parentId (self-ref), isDummy }
model GasReading   { id, deviceId (FK), ppm (float), isDummy, timestamp }
model SystemSettings { id=1 (singleton), warningThreshold=50, criticalThreshold=80, refreshInterval=10 }
model EventLog     { id, type, severity, deviceId?, ruId?, message, details (JSON),
                     acknowledged, ackNote, timestamp }
```

## Auto-Threshold Logic in addReading()
- ppm ≥ warningThreshold (50) → EventLog WARNING (15-min dedup window)
- ppm ≥ criticalThreshold (80) → EventLog CRITICAL (15-min dedup window)

## What Does NOT Exist Yet
- No MQTT listener or subscriber
- No binary frame parser
- No WebSocket / real-time GraphQL subscriptions
- No REST endpoints — pure GraphQL only
- No authentication — DEV mode email-only login
- No server pull scheduler

## Schema Fields to ADD for Hardware Integration

```prisma
// GasReading
riskLevel   String    // "LOW" | "MIDDLE" | "HIGH"
aiClass     Int       // 0–8 predicted gas type
confidence  Float     // 0.0–1.0
powerMode   String    // "BATTERY" | "EXTERNAL"

// Device
batteryMv      Int?
uptimeS        Int?
chargerStatus  String?   // "CHARGING" | "COMPLETE" | "FAULT"
meshDepth      Int?
lastSeenAt     DateTime?
clusterId      Int?      // which CH manages this GLD
```

Note: `parentId` (self-ref for tree topology) already exists from migration `20260402160751_tree_mesh_topology`.

## Production DB Plan (from Architecture.md)
SQLite → TimescaleDB (PostgreSQL) for time-series performance at scale (100M+ readings target).
