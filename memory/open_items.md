# Open Items — Decisions Needed Before Implementation

Things that are unresolved and will block specific implementation steps.

## 🔴 Critical (blocks implementation)

### 1. Node-RED decoded JSON envelope completeness
- `pertamina_gld_protocol.md` documents the `gld-event` decoded shape (`gasClass`, `confidence`, `batteryMv`, `alarm`, `externalPower`, `decryptOk`), but NestJS also needs `seq` (dedup), `clusterId` (topology/parent assignment), `rssi`/`snr` (commissioning wizard's live-verification panel, gateway health).
- Need to check the actual `pertamina-gld-decode.js`/flow output (not just the contract doc) for whether these are already emitted, or extend the function if not.
- **Blocks:** `MqttConsumerService.DecodedEventHandler`, commissioning wizard step 3.

### 2. Per-RU AES key distribution process
- Phase 1 firmware uses one global dummy key. Production needs (at minimum) one real key per RU, matched between the firmware build and that RU's Node-RED `.env`.
- Who generates it, how it's delivered to the firmware flashing process vs. the local server install — this is partly an ops/process question, not just code.
- **Blocks:** Site setup wizard step 3 (`commissioning_mode.md` §4), and going to production with anything beyond the dummy test key.

### 3. Single-DB-per-RU vs. centralized multi-RU deployment
- The schema already supports multi-tenant `ruId` tagging in one DB (current dev/demo setup spans RU2–RU7 in one SQLite file). The new requirement — one local server per RU — implies each production install is its own isolated instance with a constant `ruId`.
- Need to confirm: does the centralized multi-RU dashboard still exist (e.g., for HQ-level cross-RU visibility), aggregating from each RU's local server? Or is centralized visibility out of scope entirely?
- **Blocks:** `SystemSettings` site-setup schema design (`commissioning_mode.md` §2/§4) — if a central aggregator is needed later, the per-RU local server needs an outbound sync/export path, which isn't designed yet.

### 4. Add Node-RED to the install/start scripts
- Each RU now runs NestJS+Next.js *and* Node-RED. `start.sh`/`start.bat` currently only handle the former.
- **Blocks:** the "zero-install, double-click start.bat" experience for field installs — currently this would require a manual Node-RED setup step.

## 🟡 Important (affects architecture)

### 5. GasReading.confidence storage convention
- Wire format sends confidence as uint8 0–100. Current `GasReading.confidence` is a `Float` with no documented convention (0.0–1.0 vs 0–100) confirmed against frontend usage.
- **Affects:** `DecodedEventHandler` mapping, any existing frontend code that already assumes a 0.0–1.0 range.

### 6. Decommissioning / re-commissioning a device
- Out of scope for the first version of commissioning mode (`commissioning_mode.md` §6) — e.g. hardware swap reusing a `nodeId`. Needs a policy before it comes up in the field.

### 7. CH-internal protocol (GLD↔CH boundary, CH↔CH multi-hop)
- PertaminaGLD's locked contract (`payload-contract.draft.md`) only covers the GLD→CH→Server data unit (`GLDRecord`) and the Gateway↔Server MQTT boundary. The CH↔CH multi-hop design is still a draft, not live-tested on their side either.
- Our old `ch_protocol.md` radio parameters (frequencies, SF, sync words) are still probably valid as our own firmware's actual hardware config, but the message-type tables in that doc are superseded for anything that crosses the documented `GLDRecord` boundary.
- **Affects:** any future work on CH firmware itself (not server-side integration) — lower priority since this session's scope is server/commissioning, not CH firmware.

## 🟢 Lower Priority (design / future)

### 8. Sensor nulling/calibration trigger in the commissioning wizard
- GLD firmware has a nulling self-test mode (`gld_nulling_selftest_esp32s3`). Noted as a future wizard step, not required for V1 (`commissioning_mode.md` §5).

### 9. Production database migration
- SQLite (current dev) → TimescaleDB/PostgreSQL (planned production). Timing: before go-live, not needed for integration work.

### 10. WebSocket / real-time frontend
- Current: frontend polls every `refreshInterval` (10s default). Planned: Socket.io/GraphQL Subscriptions for instant alarm broadcasting.

### 11. Authentication
- Current: none (email-only DEV login). Planned: Keycloak JWT + RU tenant guard. Timing: before production deployment.

## ✅ Resolved (2026-06-25)

| Item | Resolution |
|---|---|
| Which CH/GLD protocol version is real | **PertaminaGLD's `payload-contract.draft.md`** is authoritative (AES-128-GCM encrypted, `GLDRecord`/34 bytes, 0–6 gas classes). Our own `Design CH_24052026.md`/`designClusterHeadMeshv3.md` drafts are superseded. See `pertamina_gld_protocol.md`. |
| Decode/decrypt location | **Node-RED stays as the bridge**, per RU, alongside NestJS. NestJS subscribes to decoded MQTT topics only — no AES/binary parsing in NestJS. See `nodered_integration.md`. |
| Device registration policy for unknown nodeId | **Auto-create in a gated state.** Unknown nodeId → `Device` row created with `commissioningStatus: 'DISCOVERED'`; readings stored but cannot raise alarms until a technician explicitly commissions the device — applies even to production-range node IDs, not just the `0xF000–0xFEFF` test range. See `commissioning_mode.md`. |
| MySQL staging for Node-RED → NestJS | **Dropped.** Node-RED publishes decoded JSON directly back onto MQTT; NestJS subscribes directly. No MySQL anywhere in this pipeline. |
