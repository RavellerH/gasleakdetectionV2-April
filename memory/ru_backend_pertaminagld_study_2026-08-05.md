# RU Backend Study: `fadlurrahmanf/PertaminaGLD`

> Study date: 2026-08-05 (Asia/Jakarta)
> Source: https://github.com/fadlurrahmanf/PertaminaGLD
> Source revision: `f9749d95882f4000a016af4efc80a8605a16cfd2`
> Revision timestamp: 2026-08-05 11:59:07 +07:00
> Scope: read-only repository study and comparison with this project's RU backend/VPS gateway contract.

## Executive conclusion

`PertaminaGLD` is the hardware-to-RU edge/server implementation, but it is not
the NestJS/GraphQL RU backend that `apps/gateway` currently expects. Its live
production boundary is MQTT from the physical Gateway into Node-RED. Node-RED
decrypts, validates, deduplicates, classifies, and republishes normalized events.

The correct relationship is therefore:

```text
GLD -> CH mesh -> physical Gateway -> MQTT broker -> PertaminaGLD Node-RED
    -> normalized MQTT events -> this repo's apps/backend (RU database/API)
    -> gatewayPull GraphQL -> this repo's apps/gateway (VPS/HQ aggregator)
```

The missing piece is a durable MQTT ingestion adapter in `apps/backend`.
`apps/gateway` should not pull directly from `PertaminaGLD`, because that repo
does not implement `gatewayPull`, GraphQL, or `x-gateway-key`.

## What the source repository contains

- ESP32 firmware for GLD detector nodes, CH mesh nodes, and Gateway roots.
- Shared binary AppFrame/GLDRecord protocol and host-side tests.
- A Node-RED server flow and generator under `server/nodered/`.
- Local operator/provisioning tools for GLD, CH, and Gateway devices.
- Dataset capture via MQTT, Node-RED, MySQL, and CSV.
- Protocol, hardware, operations, and design documentation.
- One GitHub Actions workflow for host protocol tests, simulation, secret-policy
  checks, and PlatformIO builds.

There is no Docker/Compose deployment definition and no conventional web API
application for production telemetry persistence.

## Confirmed live RU contract

### Gateway to Node-RED inputs

| MQTT topic | Meaning |
|---|---|
| `gld/gateway/uplink` | Raw Gateway wrapper containing an AppFrame (`frameHex`) and radio/parser metadata |
| `gld/gateway/topology` | CH/Gateway topology reports |
| `gld/gateway/status` | Gateway health/status snapshots |
| `gld/gateway/cmd/pull` | Server-to-Gateway pull command |
| `gld/gateway/cmd/node` | Signed server-to-node command |
| `gld/server/cmd/node` | High-level node command before Node-RED signs it |

The Gateway topic root defaults to `gld/gateway`. Deployment MQTT host,
credentials, Wi-Fi values, AES key, command authorization token, and Node-RED
admin token are placeholders/environment secrets and must be provisioned.

### Node-RED normalized outputs

| MQTT topic | Use by RU backend |
|---|---|
| `gld/server/decoded` | Valid authenticated non-alarm sensor event; ingest as a reading |
| `gld/server/alarm` | Valid authenticated alarm event; ingest as a reading and alert/event |
| `gld/server/topology` | Update Gateway/CH topology and parent relationships |
| `gld/gateway/status` | Update Gateway connectivity and health |
| `gld/server/integrity` | Record authentication/semantic failures as security/diagnostic events |
| `gld/server/replay` | Record exact replay or AES-GCM nonce-reuse rejection |
| `gld/gateway/error` | Record decoding/bridge errors |
| `gld/server/test` | Manual/test ingress; never treat as production alarm data |

### Normalized GLD event mapping

| `PertaminaGLD` event | This repo target |
|---|---|
| `nodeIdHex`, e.g. `0xF001` | Stable external device key, currently `Device.macAddress` |
| `gasClass` | `GasReading.aiClass` |
| `confidence` integer `0..100` | `GasReading.confidence` float `0..1`; divide by 100 |
| `receivedAt` | `GasReading.timestamp` (requires ingestion method to accept source time) |
| `alarm` | Alert signal; still apply RU threshold policy consistently |
| `batteryMv` | Device battery telemetry; current schema only has JSON `batteryStats` |
| `externalPower` | Device power state; current schema has no explicit field |
| `outer.srcIdHex` | Serving CH identity/topology relationship |
| `outer.gatewayIdHex` | Gateway identity |
| `seq`, `dedupKey`, nonce/fingerprint context | Required ingestion idempotency metadata; current schema has no source-event key |
| `ingressClass` | Accept `production`; quarantine or separately retain `manual`/`test` |

Important semantic mismatch: source confidence is a percentage integer, while
`DeviceService.addReading()` rejects values outside `0.0..1.0`. Passing source
confidence directly would reject nearly all useful telemetry.

## Existing local flow and incompatibility

This repository currently implements:

1. `apps/backend` stores RU devices, readings, and event logs in SQLite.
2. `apps/backend.gatewayPull(since)` exposes those records through GraphQL,
   protected by `x-gateway-key` / `GATEWAY_SYNC_KEY`.
3. `apps/gateway` calls `gatewayPull` every 30 seconds and aggregates RU data.

This chain is valid after RU ingestion. It does not ingest the actual
`PertaminaGLD` MQTT topics. The only local write endpoint is GraphQL
`addReading(macAddress, confidence, aiClass)` using `x-ingest-key`; it:

- requires a device to already exist;
- cannot ingest topology or Gateway status;
- cannot preserve source timestamp;
- cannot persist battery, sequence, source event ID, decrypt status, or power;
- performs no MQTT subscription;
- cannot atomically deduplicate redelivered MQTT events.

## Recommended implementation order

1. Add an MQTT ingestion module to `apps/backend` subscribing to the normalized
   Node-RED output topics, not the encrypted/raw Gateway uplink.
2. Add a source-event identity/idempotency table or unique key. Use a canonical
   key containing RU, Gateway/CH, node, sequence, alarm state, and authenticated
   payload fingerprint where available.
3. Add an internal transactional ingestion service that accepts source
   timestamps and upserts unknown Gateway/CH/GLD devices according to explicit
   registration policy.
4. Map `confidence / 100`, preserve `gasClass`, and derive dashboard risk using
   one documented policy. Do not infer ppm; the source publishes classification
   and confidence, not gas concentration.
5. Ingest topology/status into device JSON fields initially, then migrate to
   typed columns (`lastSeenAt`, `batteryMv`, `meshDepth`, `gatewayId`,
   `clusterId`, `externalPower`) if queries need them.
6. Convert integrity, replay, and Gateway errors into diagnostic `EventLog`
   records without generating gas alarms.
7. Keep `gatewayPull` as the RU-to-VPS boundary. Add pagination/cursor overlap
   safety before production scale; the current unbounded `since` query can grow
   large after an outage.
8. Deploy broker + Node-RED + RU backend as separate services with persistent
   volumes, TLS/authenticated MQTT, a reverse proxy, backups, monitoring, and
   secret files outside Git.

## Outstanding items found in `PertaminaGLD`

- The checked-in main Node-RED flow is out of sync with its generator:
  `node server/nodered/apply-pertamina-gld-flow.js --check` returned
  `drift: true` at the studied revision. The dataset flow check returned no
  drift. The CI workflow does not run these generator drift checks.
- Production deployment values remain intentionally unprovisioned
  (`CHANGE_ME*`/environment placeholders).
- There is no container/service deployment bundle for broker, Node-RED,
  database, TLS, backups, or observability.
- The prior audit says code findings were fixed, but field release still needs
  labeled real-sensor validation of ML feature/scaler order.
- Previously exposed Wi-Fi/MQTT credentials remain a Git-history concern per
  the upstream audit; production credentials must be rotated independently of
  the current placeholder files.
- MQTT command security assumes a trusted/authenticated broker. Production must
  use broker authentication, authorization rules, and TLS or a private secured
  network path.

## Validation performed

At source revision `f9749d9`:

- `node --test` for the three Node-RED JavaScript suites: **3 passed, 0 failed**.
- Main Node-RED generated-flow drift check: **failed, drift detected**.
- Dataset Node-RED generated-flow drift check: **passed, no drift**.
- No hardware, firmware upload, Node-RED deployment, database mutation, or VPS
  mutation was performed.

## Timestamped work log

### 2026-08-05 14:39 +07:00

- Loaded the GitHub repository-analysis workflow.
- Tried the connected GitHub repository API; it was unavailable because the
  GitHub connector is not signed in.
- Fell back to the public GitHub repository and a shallow read-only clone in
  the system temporary directory.
- Read the repository agent rules, root README, Node-RED README, current server
  design, Gateway-to-server design, operator documentation, CI workflow,
  deployment config examples, audit summary, and progress notes.
- Compared the MQTT/Node-RED event contract against local `apps/backend`
  ingestion, `gatewayPull`, and `apps/gateway` synchronization code.
- Ran the validation commands recorded above.
- Created this study and updated `memory/MEMORY.md`.

## Immediate next work in this repository

Implement the RU MQTT ingestion tranche in `apps/backend` before deploying the
VPS aggregator. The aggregator is structurally ready to consume normalized RU
data, but without this adapter it will only synchronize seeded/manual readings.
