# Open Items — Decisions Needed Before Implementation

Things that are unresolved and will block specific implementation steps.

## 🔴 Critical (blocks implementation)

### 1. Which CH protocol version is the firmware implementing?
- **Option A:** `Design CH_24052026.md` (root folder) — 10-byte AppFrame header, `hopList[]`, `CLUSTER_DATA_RESPONSE (0x31)`, `SERVER_NODE_COMMAND (0x32)`
- **Option B:** `md file design/designClusterHeadMeshv3.md` — 11-byte AppFrame header, `path_len+path[]`, `CLUSTER_BULK_DATA (0x31)`, no `SERVER_NODE_COMMAND`
- **Blocks:** AppFrameParser, PullSchedulerService, ClusterBulkDataHandler

### 2. MySQL table schema for Node-RED staging
- Run `DESCRIBE sensor_readings;` (or whatever the table is named) and share output
- **Blocks:** ReadingsPollerService field mapping

### 3. Exact binary layout of LORA_PKT_NORMAL (12-byte) and LORA_PKT_ALARM (32-byte)
- `design (1).md` Section 16 names the fields but does not give byte offsets
- **Blocks:** SensorDataAlarmHandler payload parsing

## 🟡 Important (affects architecture)

### 4. Device registration policy for unknown nodeId
- **Option A:** Skip — only pre-registered devices get readings stored (safe, explicit)
- **Option B:** Auto-create — first-seen nodeId automatically creates a Device record
- **Affects:** MqttGatewayService + ReadingsPollerService

### 5. Pending downlink GLD policy in CH firmware
- When new SERVER_NODE_COMMAND arrives but old command not yet delivered:
- **Option A:** Overwrite (new command replaces old)
- **Option B:** Queue (deliver in order)
- **Affects:** CH firmware, not server — but server retry logic depends on it

## 🟢 Lower Priority (design / future)

### 6. CH persistent storage finalization
- Candidate: ESP32 NVS, namespace `chdual`
- Data to persist: `cluster_id`, `gateway_id`, `parent_id`, `parent_id_alt`, intervals, power guard, radio tuning
- **Never persist:** cache, queue, pending downlinks

### 7. Final battery calibration offset
- Default `BATTERY_OFFSET_MV = +200 mV` — needs validation on real board
- Formula: `VBAT_MV = ADC_PIN_MV × 3.0 + 200`

### 8. Production database migration
- SQLite (current dev) → TimescaleDB/PostgreSQL (planned production)
- Timing: before go-live, not needed for integration work

### 9. WebSocket / real-time frontend
- Current: frontend polls every `refreshInterval` (10s default)
- Planned: Socket.io for instant alarm broadcasting
- Requires: backend GraphQL Subscriptions or Socket.io gateway

### 10. Authentication
- Current: none (email-only DEV login, no password check)
- Planned: Keycloak JWT + RU tenant guard
- Timing: before production deployment

## Answered / Resolved

| Item | Answer |
|---|---|
| Sensor data unit | AI risk level (LOW/MIDDLE/HIGH), not PPM |
| Gateway transport | MQTT broker |
| Node identity | uint16 nodeId as hex string in macAddress field |
| DB strategy | Hybrid: SQLite + MySQL staging |
| Node-RED role | Aggregator → MySQL staging → backend polls |
| MQTT topic scheme | `gld/gw/{gatewayId}/up` and `gld/gw/{gatewayId}/dn` (proposed) |
