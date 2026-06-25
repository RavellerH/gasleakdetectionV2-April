# Open Items — Decisions Needed Before Implementation

Things that are unresolved and will block specific implementation steps.

## 🔴 Critical (blocks implementation)

### 1. Node-RED decoded JSON envelope completeness — ✅ RESOLVED 2026-06-25
- `pertamina_gld_protocol.md` documents the `gld-event` decoded shape (`gasClass`, `confidence`, `batteryMv`, `alarm`, `externalPower`, `decryptOk`), but NestJS also needs `seq` (dedup), `clusterId` (topology/parent assignment), `rssi`/`snr` (commissioning wizard's live-verification panel, gateway health).
- Our own `nodered/functions/pertamina-gld-decode.js` (built this session, see `nodered_integration.md`) passes `seq`, `clusterId`, `rssi`, `snr` through on every decoded event — no longer blocked. Still need to confirm the *real* gateway firmware's uplink envelope actually carries `clusterId`/`rssi`/`snr` (our decoder trusts whatever's in the envelope passed to it).
- **Blocks:** `MqttConsumerService.DecodedEventHandler`, commissioning wizard step 3.

### 2. Per-RU AES key distribution process — ✅ RESOLVED 2026-06-25
- Phase 1 firmware uses one global dummy key. Production needs (at minimum) one real key per RU, matched between the firmware build and that RU's Node-RED `.env`.
- **Decision:** manual process, no tooling planned for this. Whoever flashes the firmware for an RU's GLD/CH units generates the key (e.g. `openssl rand -hex 16`), bakes it into that firmware build, and a human manually pastes the same hex string into that RU's `nodered/.env` (`GLD_AES128_KEY_HEX`) during the local server install — matching the existing "never commit a real key" rule. `start.sh`/`start.bat` auto-generate a random placeholder key on first run purely so the out-of-box demo/dev experience works; that placeholder must be manually overwritten with the real key before going live with actual GLD hardware.
- **Blocks (cleared):** Site setup wizard step 3 (`commissioning_mode.md` §4) can proceed assuming a manual paste-in step, not an automated distribution flow.

### 3. Single-DB-per-RU vs. centralized multi-RU deployment — ✅ RESOLVED 2026-06-25
- The schema already supports multi-tenant `ruId` tagging in one DB (current dev/demo setup spans RU2–RU7 in one SQLite file). The new requirement — one local server per RU — implies each production install is its own isolated instance with a constant `ruId`.
- **Decision:** yes, a centralized multi-RU dashboard still needs to exist for HQ-level cross-RU visibility, aggregating from each RU's local server.
- **Still open (not designed or implemented yet):** the outbound sync/export path from each RU's local server to the central aggregator. Each RU install remains its own isolated DB/instance (per `commissioning_mode.md`); nothing here changes that. The aggregator's data model, sync protocol (push from RU vs. pull by HQ), auth between RU and HQ, and how `ruId` collisions/identity are handled across independently-provisioned RUs are all undesigned — needs its own design pass before implementation, not bundled into this session's commissioning-mode work.

### 4. Add Node-RED to the install/start scripts — ✅ RESOLVED 2026-06-25
- Each RU now runs NestJS+Next.js *and* Node-RED. `start.sh`/`start.bat` currently only handle the former.
- **Implemented:** both scripts now also provision `nodered/.env` (generating a random placeholder AES key on first run, see item #2 above), install its dependencies (added to the root npm workspaces), and launch it as a third background process/window alongside backend and frontend.

## 🟡 Important (affects architecture)

### 5. GasReading.confidence storage convention — ✅ RESOLVED 2026-06-25
- Wire format sends confidence as uint8 0–100. Current `GasReading.confidence` is a `Float` with no documented convention (0.0–1.0 vs 0–100) confirmed against frontend usage.
- **Decision:** keep DB/GraphQL `confidence` as `Float` 0.0–1.0 — matches existing, already-built frontend threshold logic (`DevicePin.tsx`, `GasLeakDashboard.tsx`, default `warningThreshold=0.70`/`criticalThreshold=0.80`). The wire protocol's 0–100 uint8 is divided by 100 only inside `MqttConsumerService.handleDecodedEvent()` at the MQTT ingestion boundary — Node-RED's decoded JSON and the raw GLDRecord plaintext stay 0–100 (per `pertamina_gld_protocol.md`), only our own DB/API layer normalizes it. Deliberately deviates from this doc's earlier draft suggestion of storing 0–100, to avoid breaking the frontend.
- **Affects:** `DecodedEventHandler` mapping (implemented), any existing frontend code that already assumes a 0.0–1.0 range (unchanged, no longer at risk).

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
| Node-RED decoded JSON envelope completeness | `seq`/`clusterId`/`rssi`/`snr` now pass through on every decoded event. See item #1 above. |
| GasReading.confidence storage convention | Stays `Float` 0.0–1.0 in DB/GraphQL; wire's 0–100 converted only at the MQTT ingestion boundary. See item #5 above. |
| Per-RU AES key distribution | **Manual.** A human pastes the same key into the firmware build and that RU's `nodered/.env`. See item #2 above. |
| Centralized multi-RU dashboard | **Yes, still needed** for HQ-level visibility — but the RU→HQ sync path is undesigned. See item #3 above. |
| Node-RED in install/start scripts | **Implemented** in `start.sh`/`start.bat`. See item #4 above. |
