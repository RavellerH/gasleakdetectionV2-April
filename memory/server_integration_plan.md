# Server Integration Plan

Full checklist of what the NestJS backend needs to prepare to receive real hardware data via MQTT from the CH/Gateway.

## MQTT Topic Scheme (proposed)

```
Uplink   (Gateway → Broker → NestJS):  gld/gw/{gatewayId}/up
Downlink (NestJS → Broker → Gateway):  gld/gw/{gatewayId}/dn
Subscribe wildcard:                     gld/gw/+/up
```

## A. New npm Packages

```bash
npm install @nestjs/microservices mqtt   # MQTT transport
npm install @nestjs/schedule             # pull scheduler cron
npm install mysql2                       # Node-RED MySQL poller
```

## B. Prisma Schema Changes

```prisma
model GasReading {
  // ADD:
  riskLevel   String    // "LOW" | "MIDDLE" | "HIGH"
  aiClass     Int       // 0–8
  confidence  Float     // 0.0–1.0
  powerMode   String    // "BATTERY" | "EXTERNAL"
}

model Device {
  // ADD:
  batteryMv      Int?
  uptimeS        Int?
  chargerStatus  String?   // "CHARGING" | "COMPLETE" | "FAULT"
  meshDepth      Int?
  lastSeenAt     DateTime?
  clusterId      Int?
  // parentId already exists from migration 20260402160751
}
```

## C. New Module: MqttGatewayModule

```
MqttGatewayModule
  ├─ MqttGatewayService       subscribe gld/gw/+/up, publish gld/gw/{gw}/dn
  ├─ AppFrameParser           parse binary, verify CRC16-CCITT-FALSE, decode typeFlags
  ├─ SensorDataAlarmHandler   parse alarm, ACK back, call addReading(), EventLog CRITICAL
  ├─ ClusterBulkDataHandler   parse batch records, addReading() per record
  └─ ChHelloHandler           upsert Device(CH), update topology, build server registry
```

### AppFrameParser
- Validate `magic = 0xAA`
- CRC16-CCITT-FALSE over bytes 0...(N+9), big-endian
- Decode `typeFlags` → `msgType` (bits 0–5) + `FLAG_ALARM_ACK` (bit 6) + `FLAG_GLD_EXT_POWER` (bit 7)

### SensorDataAlarmHandler
```
Input: node_id (2 bytes) + GLD payload (7 bytes)
1. Parse: powerMode, operationMode, batteryMv, predicted_class, confidence
2. Map to riskLevel (see gld_payload_format.md)
3. Build ACK compact: typeFlags=0x50, payloadLen=0, same seq
4. Publish ACK to gld/gw/{gatewayId}/dn
5. deviceService.addReading(nodeIdHex, aiClass, confidence, powerMode, batteryMv)
6. EventLog CRITICAL created inside addReading() for HIGH
```

### ClusterBulkDataHandler
```
Input: chunk_id(2) + total_chunks(2) + records[]
For each record: node_id(2) + payload_len(1) + payload(N)
  → parse GLD payload → riskLevel → addReading()
```

### ChHelloHandler
```
Input: clusterId, parentId, gatewayId, batteryMv, stat1, stat2, uptimeS, meshDepth
1. Upsert Device: macAddress="0x{clusterId hex}", deviceType=CLUSTER_HEAD
2. Update: parentId, batteryMv, uptimeS, chargerStatus, meshDepth, lastSeenAt
3. Update in-memory server node registry
```

## D. New Service: PullSchedulerService

```
Every SystemSettings.refreshInterval (default 10s):
  For each known CH (from registry built via CH_HELLO):
    Build SERVER_PULL_REQUEST binary frame
    Publish to gld/gw/{gatewayId}/dn
    Track: requestId → clusterId (for correlating CLUSTER_BULK_DATA response)
```

## E. Modify DeviceService.addReading()

```typescript
// New signature:
addReading(nodeIdHex: string, aiClass: number, confidence: number, powerMode: string, batteryMv?: number)

// Risk level mapping:
if (aiClass !== 0 && confidence >= 0.80)      riskLevel = 'HIGH'
else if (aiClass !== 0 && confidence >= 0.70) riskLevel = 'MIDDLE'
else                                           riskLevel = 'LOW'

// EventLog auto-creation:
HIGH   → THRESHOLD_BREACH, severity CRITICAL
MIDDLE → THRESHOLD_BREACH, severity WARNING
LOW    → no EventLog

// 15-min dedup window per device — keep as-is
```

## F. In-Memory Server Node Registry

```typescript
registry = {
  byNodeId:    Map<nodeId, clusterId>,
  byClusterId: Map<clusterId, { gatewayId, parentId, path: number[] }>
}
// Built from CH_HELLO events, updated on topology changes
```

## G. Node-RED MySQL Poller (ReadingsPollerService)

```typescript
// Polls existing MySQL DB every refreshInterval seconds
// SELECT * FROM sensor_readings WHERE id > lastPolledId ORDER BY id ASC
// For each row: deviceService.addReading(mac_address, aiClass, confidence, ...)
// Updates: lastPolledId = max(id)
// Still needs: MySQL table schema from user (DESCRIBE table_name)
```

## Implementation Order

1. Prisma migration (add riskLevel, aiClass, confidence, powerMode, batteryMv, etc.)
2. AppFrameParser utility + CRC16-CCITT-FALSE
3. MqttGatewayModule — connect + subscribe + basic routing
4. ChHelloHandler — builds registry, simplest handler
5. SensorDataAlarmHandler — alarm path, highest priority
6. ClusterBulkDataHandler — normal data path
7. PullSchedulerService — server-initiated pull
8. Modify DeviceService.addReading() — new signature + risk mapping
9. Update frontend — show riskLevel instead of ppm display
