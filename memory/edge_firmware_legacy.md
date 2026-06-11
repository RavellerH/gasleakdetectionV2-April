# Edge Firmware — Legacy Version

**Source:** `edge-firmware-study.md`, `edge firmware/` folder

> This documents the **older** firmware generation (ESP8266/ESP32 + LLCC68 radio).
> The current design uses ESP32-S3 + SX1262. See `gld_payload_format.md` and `ch_protocol.md` for the current design.

## Device Hierarchy (Legacy)

```
ESP32-S3 Sensor Nodes
  → LoRa LLCC68 (921 MHz)
ESP8266 or ESP32 Cluster Heads
  → LoRa LLCC68 (921 MHz mesh)
ESP8266 Gateway
  → MQTT → NestJS Backend (port 4000)
```

## Legacy Message Format (struct_message)

```cpp
typedef struct struct_message {
  uint8_t sourceId;      // Sender ID (uint8, not uint16)
  uint8_t targetId;      // Recipient ID
  uint8_t networkId;     // Network ID
  uint8_t direction;     // 0=toGateway, 1=toNode
  uint8_t messageSize;   // Payload size
  uint8_t message[64];   // Max 64 bytes payload
} struct_message;
```

Serialized buffer:
```
[0] = targetId  (routing byte)
[1] = sourceId
[2] = targetId
[3] = networkId
[4] = direction
[5] = messageSize
[6..n] = message payload
```

## Legacy MQTT Topics

| Topic | Direction | Content |
|---|---|---|
| `{baseTopic}/data` | Gateway → Cloud | Sensor data JSON |
| `{baseTopic}/cmd` | Cloud → Gateway | Commands |

`baseTopic` configured per deployment (e.g., `"pertamina"`).

### MQTT Payload Example (legacy JSON)
```json
{
  "sourceId": 51,
  "targetId": 40,
  "networkId": 10,
  "direction": 0,
  "messageSize": 6,
  "message": [1, 85, 0, 0, 45, 123]
}
```

## Legacy LoRa Parameters

```cpp
LORA_FREQUENCY    = 921.0    // MHz
LORA_BANDWIDTH    = 125.0    // kHz
LORA_SPREADING    = 9        // SF9
LORA_CODING_RATE  = 7        // CR 7/8
MAX_PAYLOAD_SIZE  = 64       // bytes
```

## Legacy AI (3-class, vs current 9-class)

```
Class 0: No Gas (Normal)
Class 1: Gas Type A (leak detected)
Class 2: Gas Type B (alternative detection)

Alarm: confidence >= 80% AND class != 0
```

## Legacy Device Config via JSON (Serial)

Gateway:
```json
{
  "clusterId": 10, "networkId": 1, "toGatewayId": 1, "toNodeId": 1,
  "loraFreq": 921.0, "ssid": "...", "mqttAddress": "192.168.0.1",
  "mqttUser": "...", "mqttPass": "...", "mqttPort": 1883, "baseTopic": "pertamina"
}
```

Sensor:
```json
{
  "clusterId": 51, "networkId": 10, "targetId": 30, "mode": 0,
  "periode": 60, "toGatewayId": 40, "toNodeId": 61, "loraFreq": 921.0
}
```

## Legacy EEPROM Layout

| Address | Size | Field |
|---|---|---|
| 0 | 1 | Magic byte (Gateway=0xA6, CH ESP32=0xA5, Sensor=0xA3) |
| 1 | N | idConfig struct |

## Key Differences: Legacy vs Current Design

| Feature | Legacy | Current (SX1262 design) |
|---|---|---|
| MCU | ESP8266 / ESP32 | ESP32-S3 |
| Radio | LLCC68 | SX1262 (E22-900MM22S) |
| Frequency | 921 MHz (single) | 920 + 921 MHz (dual radio) |
| Node ID | uint8 (0–255) | uint16 (0–65535) |
| AI classes | 3 | 9 |
| Frame format | struct_message (C struct) | AppFrame (compact binary) |
| CH storage | EEPROM | NVS / Preferences (proposed) |
| MQTT payload | JSON struct | binary AppFrame (Gateway decodes) |
