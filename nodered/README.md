# GLD Node-RED Bridge (per-RU)

Decrypts/decodes PertaminaGLD gateway frames and republishes clean JSON onto
MQTT for the NestJS backend to consume. Runs as its own process per RU local
server, alongside NestJS+Next.js. See `memory/nodered_integration.md` and
`memory/pertamina_gld_protocol.md` for the design and wire format.

## Setup (one-time per RU)

```bash
cd nodered
npm install
cp .env.example .env
# edit .env: set GLD_AES128_KEY_HEX (and GLD_KEY_ID) for this RU,
# never commit the real .env
npm test     # verifies the decoder against the documented test vector
npm start    # starts Node-RED + the embedded Aedes broker on MQTT_PORT
```

Node-RED's admin UI is then at `http://localhost:1880` (or `NODE_RED_PORT`).
The flow `flows/pertamina-gld-server.flow.json` is loaded automatically via
`settings.js`'s `flowFile` setting.

## What runs where

- `settings.js` starts an embedded Aedes MQTT broker in the same process and
  exposes the decoder (`functions/pertamina-gld-decode.js`) plus this RU's
  AES key to flow function nodes via `functionGlobalContext` — the real key
  never needs to be pasted into the flow JSON.
- The flow subscribes to `gld/gateway/uplink`, decodes each GLDRecord, and
  publishes to `gld/server/decoded`, `gld/server/alarm`, or
  `gld/gateway/error` depending on validation/alarm bit.
- NestJS's `MqttConsumerService` subscribes directly to this same broker for
  those topics plus `gld/gateway/status` — see
  `apps/backend/src/modules/mqtt/mqtt-consumer.service.ts`.

## Decoder

`functions/pertamina-gld-decode.js` has no dependencies beyond Node's
built-in `crypto`, so it's also unit-tested standalone
(`functions/pertamina-gld-decode.test.js`) without needing Node-RED running.
