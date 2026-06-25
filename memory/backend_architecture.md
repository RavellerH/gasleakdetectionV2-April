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

> ⚠️ **2026-06-25:** This doc was written before the `GasReading` schema below was updated — it already has `confidence`/`aiClass`/`riskLevel`, not `ppm`. The GraphQL example below is stale (kept for now, fix once the `addReading` resolver signature is actually changed per `server_integration_plan.md`).

## GraphQL Operations

### Sensor Ingestion (only current entry point — will gain an MQTT-driven path, see below)
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
model GasReading   { id, deviceId (FK), confidence (Float), aiClass (Int), riskLevel (String), isDummy, timestamp }
model SystemSettings { id=1 (singleton), warningThreshold=0.70, criticalThreshold=0.80, refreshInterval=10 }
model EventLog     { id, type, severity, deviceId?, ruId?, operatorId?, operatorEmail?, message, details?,
                     acknowledged, acknowledgedBy?, acknowledgedAt?, ackNote, timestamp }
```

`GasReading` already carries `confidence`/`aiClass`/`riskLevel` — there is no `ppm` field in the live schema (the GraphQL example above predates this and needs fixing, not the schema).

## Auto-Threshold Logic in addReading()
- Current implementation keys off `SystemSettings.warningThreshold`/`criticalThreshold` against `confidence` — verify exact comparison once `aiClass !== 0` gating is added per `pertamina_gld_protocol.md` risk mapping (`aiClass !== 0 && confidence >= 0.80` → HIGH, etc. — confirm 0–1 vs 0–100 convention, see `open_items.md` #5).

## What Does NOT Exist Yet
- No MQTT listener or subscriber (see `server_integration_plan.md` — `MqttConsumerModule`)
- No binary frame parser or AES decrypt (intentionally — stays in Node-RED, see `nodered_integration.md`)
- No WebSocket / real-time GraphQL subscriptions
- No REST endpoints — pure GraphQL only
- No authentication — DEV mode email-only login
- No server pull/command publishing (`gld/gateway/cmd/*`)
- **No commissioning workflow** — no `commissioningStatus` field, no pending-device queue, no site setup wizard. See `commissioning_mode.md`.

## Schema Fields to ADD for Hardware Integration

```prisma
// Device — telemetry
batteryMv      Int?
lastSeenAt     DateTime?
clusterId      Int?      // which CH manages this GLD
rssi           Int?
snr            Float?

// Device — commissioning (commissioning_mode.md)
commissioningStatus String   @default("DISCOVERED") // DISCOVERED | COMMISSIONING | ACTIVE
discoveredAt         DateTime @default(now())
commissionedAt        DateTime?
commissionedBy         String?

// SystemSettings — site setup (commissioning_mode.md)
siteSetupComplete Boolean @default(false)
ruName            String?
ruLat             Float?
ruLng             Float?
mqttBrokerHost    String?
mqttBrokerPort    Int?    @default(1884)
aesKeyId          Int?    // record only — raw key material lives in Node-RED's .env, never in this DB
```

Note: `parentId` (self-ref for tree topology) already exists from migration `20260402160751_tree_mesh_topology`.

## Production DB Plan (from Architecture.md)
SQLite → TimescaleDB (PostgreSQL) for time-series performance at scale (100M+ readings target).
