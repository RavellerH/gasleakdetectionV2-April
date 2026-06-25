# Commissioning Mode — Design

**Status:** Design only, not yet implemented. Triggered by: each Refinery Unit gets its own on-prem local server install (this NestJS+Next.js stack running via `start.sh`/`start.bat`, no Docker), and on first installation there are zero known devices — yet the Gateway/CH/GLD hardware starts transmitting as soon as it's powered. We need a controlled onboarding flow instead of either (a) silently dropping unknown traffic or (b) auto-promoting unknown traffic straight into production alarms.

**Confirmed decision (2026-06-25):** gate **all** devices, including ones with a normal production-range node ID (`0x0001–0xEFFF`) — not just the `0xF000–0xFEFF` test range that PertaminaGLD's firmware already reserves. Every device must be explicitly signed off by a technician before its readings can raise a `EventLog` alarm.

**Deployment assumption:** one RU = one physical local server = one SQLite DB instance. `ruId` is set once during site setup and is effectively constant for that instance (the existing RU-tenant fields in the schema stay as-is — useful for the centralized multi-RU HQ dashboard that's confirmed to still be needed, see `open_items.md` #3; the sync path into that dashboard is undesigned).

---

## 1. Device lifecycle states

New field `Device.commissioningStatus`, independent from the existing `Device.status` (which represents live connectivity: ONLINE/OFFLINE — unrelated to commissioning, don't conflate them).

```
DISCOVERED    → first MQTT event seen for an unknown nodeId; Device row auto-created, readings stored, NO alarms
COMMISSIONING → technician has opened the onboarding wizard for this device
ACTIVE        → technician has signed off; readings now feed EventLog/alarms normally
```

There is no path back from `ACTIVE` to `DISCOVERED` in this design — decommissioning a device is a separate, later feature (not in scope here).

## 2. Prisma schema additions

```prisma
model Device {
  // existing fields unchanged...
  commissioningStatus String    @default("DISCOVERED") // DISCOVERED | COMMISSIONING | ACTIVE
  discoveredAt         DateTime  @default(now())
  commissionedAt        DateTime?
  commissionedBy         String?   // operator id who signed off
}

model SystemSettings {
  // existing fields unchanged...
  siteSetupComplete Boolean @default(false)
  ruName            String?
  ruLat             Float?
  ruLng             Float?
  mqttBrokerHost    String?   // local Node-RED/Aedes broker, usually 127.0.0.1
  mqttBrokerPort    Int?      @default(1884)
  aesKeyId          Int?      // which keyId this site's GLD fleet uses — the key material itself lives in Node-RED's .env, never in the DB
}
```

No new table needed for the device queue — `commissioningStatus = 'DISCOVERED'` on `Device` already is the pending queue.

## 3. Ingestion-side gating

In the MQTT consumer's `addReading()` path (see `server_integration_plan.md`):

```
On decoded event for nodeId:
  device = findDevice(nodeId)
  if device == null:
    device = createDevice({ macAddress: nodeIdHex, commissioningStatus: 'DISCOVERED', deviceType: inferFromKind(msg.kind), ruId: SystemSettings.ruId, ... })
    EventLog.create({ type: 'DEVICE_DISCOVERED', severity: 'INFO', ... })  // visible to technician, not an alarm

  store GasReading (always — needed for the live-verification panel in the wizard)

  if device.commissioningStatus !== 'ACTIVE':
    skip riskLevel→EventLog WARNING/CRITICAL logic entirely
    (the reading is visible in the wizard's "latest readings" panel, but never reaches the alarm pipeline)
  else:
    normal riskLevel/EventLog logic as already implemented
```

This means `DISCOVERED`/`COMMISSIONING` devices are fully visible for verification purposes but structurally cannot raise a production alarm — satisfies the "gate all devices" decision without needing a second data path.

## 4. RU site setup wizard (runs once per local server install)

Gates the rest of the app behind `SystemSettings.siteSetupComplete`. Shown on first launch when no admin user / no settings configured (ties into the existing `prisma/seed.js` first-run path used by `start.sh`/`start.bat`).

Steps:
1. **Site identity** — RU code (RU2–RU7), display name, map center/bounds for the Mapbox view.
2. **Broker config** — confirm local MQTT broker host/port (defaults to the embedded Node-RED+Aedes bridge on `127.0.0.1:1884`, per `nodered_integration.md`).
3. **AES key** — `keyId` for this site's GLD fleet. The raw key itself is generated/distributed by the firmware/ops process (see open item below) and placed directly into Node-RED's `.env` (`GLD_AES128_KEY_HEX`) on that server — the wizard only records the `keyId` for display/cross-checking, never asks for or stores the raw key in the app DB.
4. **First admin account** — replaces the current hardcoded demo login.
5. Marks `siteSetupComplete = true`.

## 5. Per-device commissioning wizard

Entry point: a "Pending Devices" view (filter `commissioningStatus IN (DISCOVERED, COMMISSIONING)`), with a banner count on the main dashboard ("3 devices awaiting commissioning").

Per device:

1. **Identity** — show `nodeIdHex`, inferred `deviceType` (GLD/CLUSTER_HEAD/GATEWAY, from which MQTT `kind`/topic it arrived on), first-seen time, raw decoded sample (`gasClass`, `confidence`, `batteryMv`, `decryptOk`).
2. **Assignment** — technician enters friendly name, pins exact location on the map (lat/lng), picks parent (CH or Gateway) from a dropdown scoped to already-`ACTIVE` devices in the same RU — populates the existing `parentId` self-relation for topology.
3. **Live verification panel** — auto-refreshing view of the last N readings for this `nodeId` (gas class, confidence, battery, RSSI/SNR from the gateway frame, `decryptOk`). Lets the technician confirm the physical unit they're standing next to is actually the one producing data, before committing.
4. **Test pull** — button that publishes a `gld/gateway/cmd/pull` request scoped to this node's cluster (see `pertamina_gld_protocol.md` topic table), so the technician doesn't have to wait for the normal TX interval during install.
5. **Commission** — enabled only once at least one reading with `decryptOk: true` has been received and required fields (name, location, parent) are filled. Sets `commissioningStatus = 'ACTIVE'`, `commissionedAt`, `commissionedBy`.

Sensor nulling/calibration (GLD firmware has a dedicated nulling self-test mode) is noted as a future addition to step 3/4, not required for V1 of this wizard.

## 6. Open items this design surfaces

- **Single-DB-per-RU vs. centralized multi-RU** — ✅ resolved 2026-06-25: each RU install stays its own isolated instance (assumption above unchanged), but a centralized HQ dashboard aggregating across RUs is still needed. The RU→HQ sync path is undesigned — see `open_items.md` #3.
- **AES key distribution process** — ✅ resolved 2026-06-25: manual. A human generates the key, bakes it into that RU's firmware build, and pastes the same value into that RU's `nodered/.env`. See `open_items.md` #2.
- **Decommissioning / re-commissioning** a device (e.g., swapped hardware reusing a `nodeId`) is explicitly out of scope for this first version.
