# Data Streaming

The Gas Leak Detector application expects real-time data from sensors and gateways. This is currently implemented via GraphQL mutations.

## 📡 Ingestion Protocol

While production systems might use MQTT, the current API uses a GraphQL mutation named `addReading`.

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
