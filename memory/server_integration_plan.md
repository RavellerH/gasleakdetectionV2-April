# Server Integration Plan

**Protocol reference:** `pertamina_gld_protocol.md` (authoritative, adopted 2026-06-25).
**Decode location decision (2026-06-25):** Node-RED stays as the bridge/decoder, per-RU, alongside NestJS — NOT ported into NestJS. NestJS only consumes already-decoded MQTT topics. See `nodered_integration.md` for the Node-RED side.

## Architecture

```
Gateway (ESP32-S3)
  → MQTT: gld/gateway/uplink, gld/gateway/status  (encrypted frame hex, JSON-wrapped)
      ↓
Node-RED + embedded Aedes broker   (one process, runs on the same RU local server)
  - AppFrame/GLDRecord parsing
  - AES-128-GCM decrypt
  - validation (gasClass range, confidence, payloadLen, tag check)
  - dedup key generation
  → MQTT: gld/server/decoded, gld/server/alarm, gld/gateway/error, gld/gateway/status
      ↓
NestJS MqttConsumerModule   (subscribes only, does not decrypt)
  → DeviceService.addReading() / EventLog / commissioning gate
      ↓
SQLite (Prisma) ← Next.js frontend (poll or future subscription)
```

This keeps NestJS protocol-agnostic — it never touches AES keys or binary frame parsing, which stay entirely inside Node-RED's flow (reusing PertaminaGLD's `pertamina-gld-decode.js` logic as the starting point, see `nodered_integration.md`).

## A. New npm packages (NestJS side only)

```bash
npm install mqtt              # MQTT client, subscribe-only
npm install @nestjs/schedule  # for periodic pull requests (gld/gateway/cmd/pull)
```

No binary parsing or crypto libraries needed in NestJS — Node-RED already produces clean JSON.

## B. Prisma schema changes

```prisma
model GasReading {
  // ADD:
  riskLevel   String   // "LOW" | "MIDDLE" | "HIGH"            -- already present in current schema.prisma, verify naming matches
  aiClass     Int      // 0–6, maps to gasClass (NOT 0–8 anymore — see protocol doc)
  confidence  Float    // store as 0–100 to match wire format directly (avoid an extra /100 conversion bug); confirm with frontend which convention it expects
  powerMode   String   // "BATTERY" | "EXTERNAL" — derived from `externalPower` boolean in decoded JSON
}

model Device {
  // ADD (ingestion/telemetry):
  batteryMv      Int?
  lastSeenAt     DateTime?
  clusterId      Int?       // which CH this GLD reports through
  rssi           Int?       // from gateway frame metadata
  snr            Float?
  // ADD (commissioning — see commissioning_mode.md):
  commissioningStatus String   @default("DISCOVERED")
  discoveredAt         DateTime @default(now())
  commissionedAt        DateTime?
  commissionedBy         String?
}
```

> Note: the live schema already has `confidence`/`aiClass`/`riskLevel` on `GasReading` (added since the original draft of this plan was written) — this section only lists what's still missing, not a from-scratch addition. Re-verify field-by-field against `apps/backend/prisma/schema.prisma` before migrating.

## C. New module: MqttConsumerModule

```
MqttConsumerModule
  ├─ MqttConsumerService     connect to local broker (default 127.0.0.1:1884), subscribe to
  │                          gld/server/decoded, gld/server/alarm, gld/gateway/status, gld/gateway/error
  ├─ DecodedEventHandler     normal/recovery events → DeviceService.addReading()
  ├─ AlarmEventHandler       alarm events → addReading() + force EventLog (subject to commissioning gate)
  ├─ GatewayStatusHandler    upsert Gateway Device row: lastSeenAt, status (ONLINE/OFFLINE)
  └─ GatewayErrorHandler     log parse/decrypt failures to EventLog severity=WARNING (ops visibility, not a device alarm)
```

### DecodedEventHandler / AlarmEventHandler

Input shape (from `gld/server/decoded` or `gld/server/alarm`, see `pertamina_gld_protocol.md`):
```json
{ "ok": true, "kind": "gld-event", "nodeIdHex": "0xF001", "gasClass": 1, "gasName": "lpg",
  "confidence": 80, "batteryMv": 3700, "alarm": false, "externalPower": false, "decryptOk": true }
```

Pipeline:
1. Look up `Device` by `nodeIdHex` (stored in `macAddress`). If missing → create with `commissioningStatus: 'DISCOVERED'` (see `commissioning_mode.md` §3).
2. Dedup check using `clusterId + nodeId + seq + kind` (need `seq`/`clusterId` passed through from Node-RED's envelope — confirm Node-RED's decoded JSON includes them, currently the documented shape above does not show `seq`/`clusterId` explicitly; **open item**, flag to firmware/Node-RED side).
3. Map `gasClass` → `aiClass`, `confidence` (0–100, store as-is), risk level:
   ```
   if aiClass !== 0 && confidence >= 80   → HIGH
   else if aiClass !== 0 && confidence >= 70 → MIDDLE
   else                                       → LOW
   ```
4. Store `GasReading` unconditionally (needed for the commissioning wizard's live-verification panel).
5. Commissioning gate: only create `EventLog` (WARNING/CRITICAL) if `device.commissioningStatus === 'ACTIVE'`. See `commissioning_mode.md` §3.
6. 15-minute dedup window per device for repeated EventLog entries — keep existing behavior.

### GatewayStatusHandler

`gld/gateway/status` keeps Gateway `Device` rows' `lastSeenAt`/`status` fresh — treat a stale `lastSeenAt` (no status in N seconds) as an OFFLINE indicator on the dashboard, independent of commissioning state.

## D. Command publishing (NestJS → Node-RED → Gateway)

```typescript
// PullSchedulerService (optional periodic) and CommissioningController (on-demand "test pull")
mqttClient.publish('gld/gateway/cmd/pull', JSON.stringify({ requestId, hopList: [clusterIdHex] }));
mqttClient.publish('gld/gateway/cmd/node', JSON.stringify({ cluster, node, id, ttl, hex }));
```

The on-demand "test pull" button in the commissioning wizard (`commissioning_mode.md` §5) is the first real consumer of this — periodic polling can come later.

## E. Implementation order

1. Confirm Node-RED decoded JSON envelope actually includes `seq`/`clusterId`/`rssi`/`snr` (needed for dedup + topology + the wizard's verification panel) — currently only documented at the `gld-event` level, not the full gateway-frame level. **Blocks step 2 below.**
2. Prisma migration (commissioning fields + telemetry fields).
3. `MqttConsumerModule` — connect + subscribe + routing skeleton.
4. `DecodedEventHandler` — normal/recovery path, with commissioning gate from day one (don't build it without the gate, then bolt it on).
5. `AlarmEventHandler` — alarm path.
6. `GatewayStatusHandler`.
7. Commissioning UI backend: device list/filter by `commissioningStatus`, sign-off mutation, test-pull mutation.
8. Update frontend to show `commissioningStatus` and the pending-devices banner.
9. `PullSchedulerService` (periodic) — lower priority than the on-demand test-pull.

## Carried over from the previous plan (still valid)

- 15-minute EventLog dedup window per device.
- `DeviceService.addReading()` keeps its role as the single write path into `GasReading`/`EventLog` — just gains the commissioning check and the new field mapping.
