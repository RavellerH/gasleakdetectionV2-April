# Data Streaming

The Gas Leak Detector application expects real-time data from sensors and gateways. The dev/demo path (below) uses GraphQL mutations directly. The planned production path integrates with the real hardware/firmware repo, [`fadlurrahmanf/PertaminaGLD`](https://github.com/fadlurrahmanf/PertaminaGLD), over MQTT — see `memory/pertamina_gld_protocol.md` and `memory/server_integration_plan.md` in this repo for the full design (those are internal working notes, not yet built).

**Planned production pipeline:** Gateway publishes encrypted (AES-128-GCM) sensor frames over MQTT → a Node-RED bridge (running per-RU, alongside this backend) decrypts and validates them → this backend subscribes to the decoded MQTT topics and writes to the database, gated by a commissioning workflow (new devices don't raise alarms until a technician signs off — see `memory/commissioning_mode.md`).

## 📡 Ingestion Protocol (current dev/demo path)

The current API uses a GraphQL mutation named `addReading`. This predates the MQTT/PertaminaGLD integration above and remains useful for local development without hardware.

### The `addReading` Mutation

```graphql
mutation AddReading($macAddress: String!, $ppm: Float!) {
  addReading(macAddress: $macAddress, ppm: $ppm) {
    id
    ppm
    timestamp
    device {
      id
      macAddress
      status
    }
  }
}
```

- **`macAddress`**: The unique physical identifier of the sensor (e.g., `RU2-MAC-SNS-1`).
- **`ppm`**: Gas concentration in Parts Per Million.

## 🛠️ Simulating Data

To test the application without physical hardware, you can use the included `simulate-sensors.js` script.

### Running the Simulator

1. Ensure the backend is running (`npm run start:dev` in `apps/backend`).
2. Run the script from the root directory:
   ```bash
   node simulate-sensors.js
   ```

The script will:
1. Connect to `http://localhost:3001/graphql`.
2. Every 5 seconds, send a random PPM reading (5-55 PPM) for a predefined list of MAC addresses.

### Customizing the Simulator
You can modify the `sensors` array in `simulate-sensors.js` to match the MAC addresses in your database.

## 🔌 Integration with Gateways

For physical LoRa gateways or MQTT brokers, you can bridge the data to the application by making HTTP POST requests to the backend:

**Example `curl` request**:
```bash
curl -X POST http://localhost:3001/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { addReading(macAddress: \"MY-SENSOR-MAC\", ppm: 12.5) { id } }"}'
```

## 📊 Reading Storage
Readings are stored in the `GasReading` model in the database. Each reading is linked to a `Device` via its `deviceId`. In production, these should be periodically archived or moved to a time-series optimized database like TimescaleDB.

## 🏭 Commissioning (planned)

Each Refinery Unit runs its own local server install. On first installation there are no known devices yet — but hardware starts transmitting as soon as it's powered. A new device is auto-registered but starts in a `DISCOVERED` state: its readings are stored and visible to a technician for verification, but cannot raise a production alarm until it's explicitly commissioned (identity confirmed, location pinned, parent topology assigned, a live test reading verified). See `memory/commissioning_mode.md` for the full design — not yet implemented.
