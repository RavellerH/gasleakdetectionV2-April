# GLD Sensor Payload Format

**Source docs:** `md file design/designnodeGLDv2.md`, `md file design/design (1).md`

## AppFrame Wire Format (Both GLD and CH)

| Offset | Field | Size | Notes |
|---|---|---|---|
| 0 | Preamble `0xAA` | 1 | Magic byte, always first |
| 1 | Version | 1 | |
| 2 | Net (`0=STAR`) | 1 | |
| 3 | MsgType | 1 | See registry below |
| 4 | Flags | 1 | FLAG_ALARM=0x04, FLAG_ACK_RSP=0x02 |
| 5..6 | SrcId | 2 | big-endian uint16 |
| 7..8 | DstId | 2 | big-endian uint16, 0xFFFF=broadcast |
| 9 | Len | 1 | payload length in bytes |
| 10..N | Payload | N | compact binary |
| N+1..N+2 | CRC16 | 2 | CRC16-CCITT-FALSE, big-endian |

> **Note:** `Design CH_24052026.md` (newer) uses a slightly different 10-byte header:
> `magic(1), typeFlags(1), srcId(2), dstId(2), seq(1), payloadLen(1)` — no version/net bytes.
> See `ch_protocol.md` for version differences.

## SENSOR_DATA Payload — v1 (7 bytes)

| Byte | Field | Size | Values |
|---|---|---|---|
| 0 | schema_version | 1 | always `1` |
| 1 | power_mode | 1 | `0`=battery, `1`=external |
| 2 | operation_mode | 1 | `0`=running, `1`=training, `2`=nulling |
| 3..4 | battery_mV | 2 | uint16 big-endian |
| 5 | predicted_class | 1 | uint8, `0`=normal gas, `1–8`=gas types |
| 6..7 | confidence × 10000 | 2 | uint16 big-endian → divide by 10000 for float |

**Total payload = 7 bytes. Total STAR frame = 18 bytes.**

## AI Model

```
Output classes : 9  (class 0..8)
Class 0        : normal / no gas detected
Class 1–8      : specific gas types (from ML training)
Confidence     : 0.0–1.0  (sent as ×10000 uint16)
Alarm threshold: confidence >= 0.80 AND predicted_class != 0
```

## Alarm Rule (GLD firmware)

```
FLAG_ALARM set when:
  predicted_class != 0
  AND confidence >= 0.80

Alarm frames → request ACK from CH
Normal frames → no ACK needed
```

## Risk Level Mapping (server-side, from AI output)

| Condition | Risk Level | Action |
|---|---|---|
| `predicted_class == 0` OR `confidence < 0.70` | **LOW** | Save reading, no alert |
| `predicted_class != 0` AND `0.70 ≤ conf < 0.80` | **MIDDLE** | Save + EventLog WARNING |
| `predicted_class != 0` AND `confidence ≥ 0.80` | **HIGH** | Save + EventLog CRITICAL + send ACK |

> No PPM values. The system uses AI classification, not threshold-based gas concentration.

## LoRa Packet Types (Section 16 of design (1).md)

```cpp
enum LoRaPacketType : uint8_t {
    LORA_PKT_NORMAL = 0x01,  // 12 bytes: packetType,deviceId,seq,powerMode,aiClass,confidence,finalStatus,flags,batteryMv
    LORA_PKT_ALARM  = 0x02,  // 32 bytes: header+nullingProfileId+anomalyMaxZx10+activeSensorCount+sensorMv[8]
    LORA_PKT_ACK    = 0x03,  //  6 bytes: packetType,deviceId,seq,ackStatus
    LORA_PKT_HEALTH = 0x04   // 12 bytes: packetType,deviceId,seq,powerMode,healthFlags,errorCode,batteryMv
};
```

> Exact byte-by-byte layout of Normal (12-byte) and Alarm (32-byte) is still **open** — not locked in design docs.

## STAR Message Types (GLD ↔ CH)

| Code | Name | Direction |
|---|---|---|
| `0x10` | SENSOR_DATA | GLD → CH |
| `0x12` | STAR_ACK | CH → GLD |
| `0x14` | NODE_DOWNLINK | CH → GLD (commands from server) |

## 8 MQ Sensor Channel Mapping

| ADS1256 CH | Sensor | Gas Target |
|---|---|---|
| CH0 | MQ8 | H2 / CO |
| CH1 | MQ135 | NH3 / CO2 / NOx |
| CH2 | MQ3 | Alcohol / Benzene |
| CH3 | MQ5 | LPG / Natural Gas |
| CH4 | MQ4 | Methane / CNG |
| CH5 | MQ7 | CO |
| CH6 | MQ6 | LPG / Butane |
| CH7 | MQ2 | Smoke / Propane |

## ACK Policy (GLD side)

- Alarm (`FLAG_ALARM`): 5 retry attempts, ACK timeout 2000ms
- Normal: no ACK, no retry
- Battery mode: after TX, open 2000ms receive window for ACK + downlink before sleeping
