# RU IV Cilacap â clean device register

`apps/backend/prisma/seed-ru4-cilacap.js` prepares an RU4 backend database for
field use. It does **not** create demo readings.

What it does:

1. Deletes every demo record (`isDummy = true`) and the readings/events of those
   devices (plus device-less demo LOGIN/ACK events). Real devices
   (`isDummy = false`) are kept. Note: before this change, devices registered
   from the dashboard were also stored as `isDummy = true`, so they are removed
   too — list them in the register file instead.
2. Upserts the devices listed in the register file by `macAddress`, with
   `isDummy = false`, status `OFFLINE` until the first telemetry arrives.
3. Creates the first admin user only when the database has no users, using
   `GLD_ADMIN_EMAIL` and `GLD_ADMIN_PASSWORD` (at least 12 characters).
4. Warns if any existing user still has the demo password `admin`.

```bash
cd apps/backend
cp ../../deploy/ru4/devices.ru4.example.json ../../deploy/ru4/devices.ru4.json   # then edit
GLD_ADMIN_EMAIL=admin@ru4.local GLD_ADMIN_PASSWORD='<min 12 chars>' \
  node prisma/seed-ru4-cilacap.js ../../deploy/ru4/devices.ru4.json
```

Before go-live, replace in the register file:

- `macAddress` with the node IDs actually flashed into each GW/CH/GLD
  (PertaminaGLD `nodeIdHex`, e.g. `0x1001`; the GTS sample is `GLD2-0x1001`).
- `location` with surveyed coordinates (the example values are placeholders
  around the RU4 map centre).
- `area` with the plant area / unit agreed with RU IV HSE.
- `parent` with the planned CH attachment (the live parent is learned from
  topology later).

Device counts follow the installation planning basis (3 GLD, 6 CH, 1 Gateway).

## Live data from PertaminaGLD (MQTT ingest)

`apps/backend` subscribes to the topics published by the PertaminaGLD Node-RED
flow (`server/nodered/functions/pertamina-gld-decode.js`) when `MQTT_URL` is set
(see `apps/backend/.env.example`). Use the broker credentials that Node-RED uses;
they are generated locally and must not be committed.

| Topic | Stored as |
|---|---|
| `gld/server/decoded` | `GasReading` (confidence 0..100 → 0.0..1.0, `receivedAt` kept) |
| `gld/server/alarm` | `GasReading` + `GAS_ALARM` event (CRITICAL) |
| `gld/server/topology` | CH status, parent, RSSI, battery (discovery-only reports do not change parent) |
| `gld/gateway/status` | Gateway ONLINE / last seen |
| `gld/server/integrity`, `gld/server/replay` | `SECURITY` event |
| `gld/gateway/error` | `DIAGNOSTIC` event |
| `gld/server/test` | ignored |

- Device key = `nodeIdHex` (`macAddress` in this register). Frames from IDs not in
  the register are **not** stored; an `UNKNOWN_DEVICE` event is logged instead.
- Duplicates are dropped by `sourceKey` = AES-GCM key ID + nonce, which Node-RED
  already guarantees unique per authenticated record.
- Risk level: Clean Air (class 0) is always LOW; otherwise the dashboard
  thresholds apply, and a GLD alarm flag never reports below MIDDLE.
- Battery % for battery-powered nodes is a linear 3.30–4.20 V estimate for
  display only; externally powered (24 VDC) nodes show 100 %.
