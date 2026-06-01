# Edge Firmware Study Document

## Overview

The edge firmware implements a **LoRa Mesh Network** for gas leak detection across multiple Refinery Units (RU). The system consists of three tiers of devices with different responsibilities.

---

## Network Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CLOUD / BACKEND                                 │
│                   (NestJS + GraphQL + MQTT)                             │
│                          Port 4000                                      │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ MQTT / WiFi
┌──────────────────────────────▼──────────────────────────────────────────┐
│                        GATEWAY (ESP8266)                                 │
│  • Receives LoRa from Cluster Heads                                       │
│  • Forwards to Cloud via MQTT                                            │
│  • Stores config in EEPROM                                               │
│  • LoRa: 921 MHz, ESP-NOW for local comms                               │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ LoRa Mesh (921 MHz)
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
┌────────▼────────┐   ┌────────▼────────┐   ┌────────▼────────┐
│  CLUSTER HEAD   │   │  CLUSTER HEAD   │   │  CLUSTER HEAD   │
│   (ESP8266)     │   │    (ESP32)      │   │    (ESP32)      │
│                 │   │                 │   │                 │
│ • Mesh routing  │   │ • Mesh routing  │   │ • Mesh routing  │
│ • Star to Sns   │   │ • Star to Sns   │   │ • Star to Sns   │
└────────┬────────┘   └────────┬────────┘   └────────┬────────┘
         │                     │                     │
         │      ESP-NOW        │      ESP-NOW        │
         ▼                     ▼                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        SENSOR NODES (ESP32-S3)                           │
│  • MQ Gas Sensors (MQ2, MQ3, MQ4, MQ5, MQ6, MQ7, MQ8, MQ135)           │
│  • ADS1256 ADC (24-bit precision)                                        │
│  • Neural Network for leak classification                                 │
│  • LoRa + ESP-NOW communication                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Device Types

### 1. Gateway (ESP8266)
**File:** `loraMeshGateway/Gateway.cpp`

| Component | Details |
|-----------|---------|
| MCU | ESP8266 |
| Radio | LoRa LLCC68 (921 MHz) |
| Communication | LoRa Mesh + MQTT + ESP-NOW |
| Storage | EEPROM (512 bytes) |
| Config | clusterId, networkId, toGatewayId, toNodeId, loraFreq, WiFi, MQTT |

**Key Features:**
- Receives from Cluster Heads via LoRa
- Publishes to MQTT broker (`<baseTopic>/data`)
- Subscribes to commands via MQTT (`<baseTopic>/cmd`)
- EEPROM stores all configuration
- JSON config via Serial: `{"clusterId":10,"networkId":1,"toGatewayId":1,"toNodeId":1,"loraFreq":921,"ssid":"...","mqttAddress":"192.168.0.1","mqttPort":1883,"baseTopic":"pertamina"}`

### 2. Cluster Head (ESP8266/ESP32)
**Files:** 
- `loraMeshClusterHead/ClusterHeadESP8266.cpp`
- `loraMeshClusterHead_ESP32/ClusterHeadESP32.cpp`

| Component | Details |
|-----------|---------|
| MCU | ESP8266 or ESP32 |
| Radio | LoRa LLCC68 (921 MHz) |
| Communication | LoRa Mesh + ESP-NOW |
| Storage | EEPROM (512 bytes) |

**Functions:**
- Routes messages between Gateway and Sensors
- Star topology with local sensors (ESP-NOW)
- Mesh topology with other Cluster Heads (LoRa)

### 3. Sensor Node (ESP32-S3)
**File:** `Gasleak/loraMeshGasleak/Gasleak.cpp`

| Component | Details |
|-----------|---------|
| MCU | ESP32-S3 |
| Gas Sensors | MQ2, MQ3, MQ4, MQ5, MQ6, MQ7, MQ8, MQ135 |
| ADC | ADS1256 (24-bit, 8-channel) |
| I2C Mux | TCA9548 (8-channel) |
| DAC | MCP4725 (potentiometer for calibration) |
| Radio | LoRa LLCC68 (921 MHz) + ESP-NOW |
| AI | TensorFlow Lite Neural Network (3 classes) |

---

## Sensor Configuration

```
Channel 0: MQ8  (H2/CO)
Channel 1: MQ135 (NH3/CO2/NOx)
Channel 2: MQ3  (Alcohol/ Benzene)
Channel 3: MQ5  (LPG/ Natural Gas)
Channel 4: MQ4  (Methane/ CNG)
Channel 5: MQ7  (CO)
Channel 6: MQ6  (LPG/ Butane)
Channel 7: MQ2  (Smoke/ Propane)
```

---

## Message Protocol

### Struct Message Format
```cpp
typedef struct struct_message {
  uint8_t sourceId;      // Sender ID
  uint8_t targetId;      // Recipient ID
  uint8_t networkId;     // Network ID
  uint8_t direction;     // 0=toGateway, 1=toNode
  uint8_t messageSize;   // Payload size
  uint8_t message[64];   // Max 64 bytes
} struct_message;
```

### Serialized Buffer Format
```
[0]       = targetId (for routing)
[1]       = sourceId
[2]       = targetId
[3]       = networkId
[4]       = direction
[5]       = messageSize
[6..n]    = message payload
```

---

## Configuration via JSON

### Gateway Config
```json
{
  "clusterId": 10,
  "networkId": 1,
  "toGatewayId": 1,
  "toNodeId": 1,
  "loraFreq": 921.0,
  "ssid": "WiFi_SSID",
  "ssidPass": "WiFi_Password",
  "mqttAddress": "192.168.0.1",
  "mqttUser": "mqtt_user",
  "mqttPass": "mqtt_pass",
  "mqttPort": 1883,
  "baseTopic": "pertamina"
}
```

### Sensor Node Config
```json
{
  "clusterId": 51,
  "networkId": 10,
  "targetId": 30,
  "mode": 0,
  "periode": 60,
  "toGatewayId": 40,
  "toNodeId": 61,
  "loraFreq": 921.0
}
```

---

## Operating Modes (Sensor Node)

| Mode | Name | Description |
|------|------|-------------|
| 0 | RUNNING | Normal operation, auto-transmit on leak detection |
| 1 | TRAINING | Data collection mode, publishes to MQTT |
| 2 | SETUP | Calibration mode, finds optimal potentiometer values |

### Mode Commands (via Serial)
```
show       - Print current config
reset      - Erase EEPROM and restart
DEBUG_ON   - Enable debug output
DEBUG_OFF  - Disable debug output
RUNNING    - Switch to running mode
TRAINING   - Switch to training mode
SETUP      - Switch to calibration mode
restart    - Restart device
```

---

## Neural Network (Edge AI)

**File:** `Gasleak/loraMeshGasleak/NeuralNetwork.cpp`

The sensor uses a trained neural network to classify gas readings into 3 classes:
- **Class 0**: No Gas (Normal)
- **Class 1**: Gas Type A (Leak detected)
- **Class 2**: Gas Type B (Alternative detection)

**Inference Process:**
1. Read 8 gas sensor voltages via ADS1256
2. Normalize using pre-computed mean/std (from training)
3. Run TensorFlow Lite inference
4. Output predicted class + confidence score
5. If confidence >= 80% and class != 0 → Auto-transmit

---

## Calibration Process

The sensor uses MCP4725 digital potentiometers to calibrate each MQ sensor:

1. **Preheat**: Wait for sensor delta < 10mV
2. **Binary Search**: Find the voltage threshold where sensor resistance changes
3. **Store Wiper Values**: Save 8 values (one per channel) to EEPROM

```cpp
void binarySearchVisual(uint16_t low, uint16_t high) {
  // MCP4725 range: 0-4095
  // For each channel, find optimal wiper value
  // that produces voltage change at gas detection threshold
}
```

---

## MQTT Topics

| Topic | Direction | Description |
|-------|-----------|-------------|
| `<baseTopic>/data` | Gateway→Cloud | Sensor data (sourceId, ppm, rssi, etc.) |
| `<baseTopic>/cmd` | Cloud→Gateway | Commands to forward to sensors |

### MQTT Payload Example
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

---

## Integration with App Backend

### Data Flow
```
ESP32-S3 (Sensor)
    │ LoRa (mesh)
    ▼
ESP32/ESP8266 (Cluster Head)
    │ LoRa (mesh)
    ▼
ESP8266 (Gateway)
    │ MQTT
    ▼
NestJS Backend (Port 4000)
    │ GraphQL
    ▼
Next.js Frontend
```

### App Database Schema (Prisma)

The app stores devices with these identifiers that map to firmware:
- `macAddress`: Unique device ID (e.g., "RU2-GW-01", "RU2-CH-01", "RU2-SNS-01")
- `deviceType`: GATEWAY, CLUSTER, SENSOR
- `ruId`: Refinery Unit ID (RU2-RU7)
- `location`: Lat/Lng coordinates
- `batteryStats`: Voltage, SOC
- `networkStats`: RSSI, quality score

### GraphQL Queries

```graphql
# Get devices for a RU
query Devices($ruId: String!) {
  devices(ruId: $ruId) {
    id
    macAddress
    deviceType
    location { lat lng }
    battery { voltage soc }
    network { rssi qualityScore }
    healthScore
    latestPpm
    status
  }
}

# Get dashboard statistics
query GetDashboardStats {
  getDashboardStats {
    totalDevices
    onlineDevices
    totalAlerts
    avgHealth
    ruData { ru total online alerts health }
  }
}
```

---

## Currently Mapped Features

| Firmware Feature | App Implementation | Status |
|-----------------|-------------------|--------|
| Device Types (Gateway/Cluster/Sensor) | deviceType field | ✅ Done |
| RU Assignment | ruId field | ✅ Done |
| Gas Readings | ppm from sensors | ✅ Done |
| Location | location field (lat/lng) | ✅ Done |
| Network Quality | rssi from LoRa | ⚠️ Partial |
| Battery Status | batteryStats field | ⚠️ Partial |
| Alert Thresholds | warningThreshold/criticalThreshold | ✅ Done |
| User Authentication | login mutation | ✅ Done |

---

## Potential Integrations

1. **MQTT Consumer Service**: Parse incoming MQTT messages from Gateway and store in database
2. **Real-time RSSI Monitoring**: Display live signal strength from LoRa mesh
3. **Firmware Version Tracking**: Add `fw_version` field to devices
4. **OTA Updates**: Implement firmware update mechanism via MQTT
5. **Mesh Topology Visualization**: Show LoRa mesh connections on map
6. **ML Inference Results**: Store and display neural network predictions

---

## Configuration Parameters

### EEPROM Layout

| Address | Size | Field |
|---------|------|-------|
| 0 | 1 byte | Magic byte (0xA5/A6) |
| 1 | N bytes | idConfig struct |

### Magic Bytes
- Gateway: `0xA6`
- Cluster Head ESP32: `0xA5`
- Sensor Node: `0xA3`

---

## Key Constants

```cpp
#define LORA_FREQUENCY    921.0    // MHz (for Indonesia)
#define LORA_BANDWIDTH    125.0    // kHz
#define LORA_SPREADING    9        // SF9
#define LORA_CODING_RATE  7        // CR7/8
#define LORA_TRANSMIT_TIMER  2500  // ms (random 2500-5500)
#define MAX_PAYLOAD_SIZE  64       // bytes
#define EEPROM_SIZE       512      // bytes
#define ADS1256_GAIN      PGA_1    // Auto-adjusted per channel
#define ADS1256_DRATE     DRATE_1000SPS
```

---

## Summary

The edge firmware implements a robust LoRa mesh network for industrial gas leak detection:

1. **Hierarchical Design**: Gateway → Cluster Heads → Sensors
2. **Mesh + Star Topology**: LoRa for long-range mesh, ESP-NOW for local star
3. **Edge AI**: Neural network runs on-sensor for real-time leak classification
4. **Self-Calibrating**: Digital potentiometers enable automated sensor calibration
5. **Cloud Integration**: MQTT bridges edge to NestJS backend

The app currently displays device status, locations, and gas readings. Future integrations could include real-time MQTT ingestion, mesh topology visualization, and OTA firmware management.
