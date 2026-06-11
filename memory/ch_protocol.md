# Cluster Head (CH) Protocol

**Source docs:** `Design CH_24052026.md` (root, newer), `md file design/designClusterHeadMeshv3.md` (v3)

## Hardware

- MCU: ESP32-S3-WROOM-1U
- Radio A (U1): SX1262 / E22-900MM22S — STAR link to GLD nodes
- Radio B (U3): SX1262 / E22-900MM22S — MESH/TREE link to Gateway
- Shared SPI bus (IO11 MOSI / IO12 SCK / IO13 MISO) — mutex required with FreeRTOS
- Battery ADC: IO4 via voltage divider 200kΩ/100kΩ (ratio 3.0, offset +200mV)
- Charger: BQ25185, STAT1=IO3, STAT2=IO46
- LED: IO19, active LOW

## Radio Parameters

| Parameter | Radio A / STAR | Radio B / MESH |
|---|---|---|
| Frequency | 920.0 MHz | 921.0 MHz |
| Bandwidth | 125 kHz | 125 kHz |
| Spreading Factor | SF7 | SF9 |
| Coding Rate | 4/5 | 4/5 |
| Sync Word | 0x12 | 0x34 |
| Default TX Power | 17 dBm | 17 dBm |
| Max TX Power | 22 dBm | 22 dBm |
| Preamble | 8 | 8 |
| TCXO | 1.6 V | 1.6 V |

## ⚠️ Two Protocol Versions — Must Confirm Which is Final

| Item | `Design CH_24052026.md` (newer) | `designClusterHeadMeshv3.md` (v3) |
|---|---|---|
| Frame header | **10 bytes** (no version/net field) | **11 bytes** (has version + net) |
| Pull response | `CLUSTER_DATA_RESPONSE (0x31)` | `CLUSTER_BULK_DATA (0x31)` |
| Pull request routing | `requestId + hopList[]` | `path_len + path[] + from_time + max_records + max_bytes` |
| Alarm forwarding type | `SENSOR_DATA + FLAG_ALARM_ACK (0x50)` | `CH_DATA_UP (0x20) + FLAG_ALARM (0x04)` |
| ACK compact format | `typeFlags=0x50, payloadLen=0` | same |

## MESH Message Types

### v3 (designClusterHeadMeshv3.md)
| Code | Name | Direction |
|---|---|---|
| `0x10` | SENSOR_DATA (alarm fwd) | CH → Gateway |
| `0x20` | CH_DATA_UP | CH → Gateway |
| `0x30` | SERVER_PULL_REQUEST | Gateway → CH |
| `0x31` | CLUSTER_BULK_DATA | CH → Gateway |
| `0x33` | CH_HELLO | CH → Gateway |
| `0x34` | CH_CONFIG_REQUEST | CH → Broadcast |
| `0x35` | CH_CONFIG_RESPONSE | Parent → CH |

### CH_24052026 (newer)
| Code | Name | Direction |
|---|---|---|
| `0x10` | SENSOR_DATA (incl. alarm fwd) | CH → Parent |
| `0x30` | SERVER_PULL_REQUEST | Gateway → CH |
| `0x31` | CLUSTER_DATA_RESPONSE | CH → Gateway |
| `0x32` | SERVER_NODE_COMMAND | Gateway → CH |
| `0x33` | CH_HELLO | CH → Parent |
| `0x34` | CH_CONFIG_REQUEST | CH → Broadcast |
| `0x35` | CH_CONFIG_RESPONSE | Parent → CH |

## Data Classification

- **Normal data:** FLAG_ALARM not set → stored in CH RAM buffer, sent only on SERVER_PULL_REQUEST
- **Alarm data:** FLAG_ALARM set → pushed immediately via priority queue, requires ACK

## CH → Gateway Payload Wrappers

**Alarm (CH_DATA_UP + FLAG_ALARM / v3):**
```
node_id (2 bytes) + sensor_payload (7 bytes GLD v1 payload)
```

**Normal batch (CLUSTER_BULK_DATA / v3):**
```
chunk_id (2) + total_chunks (2) + records[]:
  node_id (2) + payload_len (1) + payload (N)
```

## CH_HELLO Payload (every 300 seconds)

```
clusterId (2), parentId (2), gatewayId (2), batteryMv (2),
stat1 (1), stat2 (1), uptimeS (4), meshDepth (1),
protocolVersion (1), role (1), caps (2)
```

## Queue Structure

| Queue | Capacity | Priority | Contents |
|---|---|---|---|
| `alarmQueue` | 8 | 1 (highest) | Alarm GLD data, CH battery/charger faults |
| `responseQueue` | 8 | 2 | CLUSTER_DATA_RESPONSE / CLUSTER_BULK_DATA |
| `helloQueue` | 4 | 3 (lowest) | CH_HELLO |

TX order: alarm → response → hello

## ACK Policy

- Alarm frames only get ACK
- ACK compact: `typeFlags=0x50`, `payloadLen=0`, same `seq` as alarm
- Retry: 5 attempts, exponential backoff 200ms × 2^attempt
- Parent failover: after 3 consecutive ACK failures → try parentAlt → CH_CONFIG

## State Machine

```
ST_BOOT → ST_WAIT_BATT → ST_RADIO_INIT → ST_JOINING → ST_JOINED
ST_JOINED    → ST_LOW_POWER        (batt < 3150 mV)
ST_JOINED    → ST_PARENT_FAILOVER  (alarm ACK fails >= 3 times)
ST_JOINED    → ST_RECOVERY         (radio error or 5 no-ACK burst)
ST_LOW_POWER → ST_RESTART          (batt recovers or lockout > 180s)
```

## Battery Thresholds

| Parameter | Value |
|---|---|
| Boot minimum (radio init allowed) | 3500 mV |
| Runtime TX normal minimum | 3150 mV |
| Critical alarm TX minimum | 3100 mV |
| Stable samples needed | 8 samples × 1000ms gap |
| Lockout restart timeout | 180,000 ms |

## Server Node Registry (server must maintain)

```
nodeId     → clusterId          (which CH manages this GLD)
clusterId  → gatewayId          (which Gateway)
clusterId  → parentId           (CH tree parent)
clusterId  → pathFromGateway    (hop list for targeted pull requests)
```

Built from: CH_HELLO, CH_DATA_UP srcId, CLUSTER_BULK_DATA srcId.

## Cache Timers (RAM only, never persisted)

| Parameter | Value |
|---|---|
| NODE_STALE_MS | 300,000 ms (5 min) |
| NODE_OFFLINE_MS | 1,800,000 ms (30 min) |
| CACHE_EXPIRE_MS | 3,600,000 ms (1 hour) |
| CACHE_CLEANUP_MS | 60,000 ms |

## Open Items in CH Design

- Persistent storage mechanism: NVS namespace `chdual` proposed but not finalized
- Pending downlink policy: overwrite vs queue when new command arrives before old sent
- Battery calibration offset: default +200 mV, needs real board validation
- Parent scoring: currently RSSI-best, additional criteria may be added after field testing
