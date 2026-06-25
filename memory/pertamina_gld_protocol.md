# PertaminaGLD Wire Protocol — Authoritative Reference

**Source of truth:** [`fadlurrahmanf/PertaminaGLD`](https://github.com/fadlurrahmanf/PertaminaGLD) — the real firmware team's repo.
**Status:** Adopted 2026-06-25 as authoritative, superseding `gld_payload_format.md` and the v3/CH_24052026 drafts referenced in `ch_protocol.md`.
Primary contract file there: `docs/design/gld-ch/payload-contract.draft.md`.

> This repo is firmware + bench-server only. It does not include a frontend, a production database, or a commissioning workflow — those remain ours to build (see `commissioning_mode.md` and `server_integration_plan.md`).

## Why this supersedes our drafts

Our own `Design CH_24052026.md` / `designClusterHeadMeshv3.md` were internal speculative drafts. PertaminaGLD is the actual firmware repo with byte-exact structs and a validated AES-GCM test vector. Material differences from our drafts:

| Item | Our draft assumed | PertaminaGLD (real) |
|---|---|---|
| Sensor payload | Plaintext, 7 bytes | **Encrypted**, AES-128-GCM |
| AI classes | 0–8 (9 classes) | 0–6 (gasClass; 5 reserved) |
| Confidence encoding | uint16 ×10000 | uint8, 0–100 directly |
| ACK / retry | GLD↔CH ACK with retries | Not specified in contract (CH-GLD boundary still has separate `design.md`/`design.updated.draft.md`, not yet folded into this contract) |
| MQTT topics | `gld/gw/{gatewayId}/up` / `/dn` | `gld/gateway/uplink`, `gld/gateway/cmd/*`, `gld/server/decoded`, `gld/server/alarm` |

## GLDRecord (34 bytes) — CH/Gateway → Server unit of data

| Offset | Field | Size | Encoding | Notes |
|---|---|---|---|---|
| 0–1 | `nodeId` | 2 | uint16 BE | GLD identifier |
| 2 | `seq` | 1 | uint8 | GLD sequence number |
| 3 | `flags` | 1 | uint8 | bit0=`ALARM`, bit4=`EXT_POWER`, others reserved (must be 0) |
| 4 | `payloadLen` | 1 | uint8 | Must equal 29 (Phase 1) |
| 5–33 | `payload` | 29 | opaque | Encrypted sensor data, see below |

A CH response (`CLUSTER_DATA_RESPONSE`, `0x31`) can carry up to 2 `GLDRecord`s per 80-byte MESH frame.

## Encrypted payload (29 bytes)

| Offset | Field | Size | Notes |
|---|---|---|---|
| 0 | `keyId` | 1 | Unencrypted; selects which AES key to use |
| 1–12 | `nonce` | 12 | AES-GCM 96-bit nonce, hardware RNG, must never repeat for a given key |
| 13–16 | `ciphertext` | 4 | AES-GCM ciphertext of the 4-byte plaintext |
| 17–28 | `tag` | 12 | AES-GCM authentication tag |

## Plaintext (4 bytes, pre-encryption)

| Offset | Field | Size | Type | Range |
|---|---|---|---|---|
| 0 | `gasClass` | 1 | uint8 | 0=clear, 1=LPG, 2=propane, 3=butane, 4=methane, 5=reserved, 6=anomaly |
| 1 | `confidence` | 1 | uint8 | 0–100 (already a percentage — **not** 0.0–1.0 and **not** ×10000) |
| 2–3 | `batteryMv` | 2 | uint16 BE | 0–65534 mV; `0xFFFF` = invalid/unavailable |

## AES-128-GCM parameters

- Key size: 16 bytes. Nonce: 12 bytes. Tag: 12 bytes. Plaintext: 4 bytes (no padding).
- **AAD (5 bytes):** `nodeId (2, BE) + gldSeq (1) + recordFlags (1) + keyId (1)` — all sourced from the `GLDRecord` header + payload byte 0, not transmitted separately.
- Phase 1 uses one **global** key (`keyId = 1`). Production / multi-RU needs per-RU (or per-device) keys — open item, see `open_items.md`.

### Test vector (dummy key — for validating our decoder, never use in production)

```
Key:          000102030405060708090A0B0C0D0E0F
NodeId:       0xF001
GLD Seq:      0x2A
Record Flags: 0x11
Nonce:        101112131415161718191A1B
Plaintext:    01500E74   (gasClass=LPG, confidence=80, batteryMv=3700)
Ciphertext:   C57E0DDB
Tag:          F88ABEC591E9F5BFAD982A6C
Encrypted payload (keyId+nonce+ct+tag): 01101112131415161718191A1BC57E0DDBF88ABEC591E9F5BFAD982A6C
```

## Device ID ranges

| Range | Meaning |
|---|---|
| `0x0001–0xEFFF` | Production devices |
| `0xF000–0xFEFF` | Test/manual devices — decodable and displayable, **must never trigger production alarms** |
| `0xFF00–0xFFFF` | System / future use |

> Our commissioning design reuses this convention but adds a per-device DB-level gate (`commissioning_mode.md`) — even a production-range ID must be explicitly commissioned before it can raise alarms, not just rely on its ID range.

## AppFrame TypeFlags (GLD-originated)

| Value | Meaning |
|---|---|
| `0x10` | SENSOR_DATA, normal, battery power |
| `0x90` | SENSOR_DATA, normal, external power (`FLAG_GLD_EXT_POWER`) |
| `0x50` | SENSOR_DATA + `FLAG_ALARM_ACK`, battery power |
| `0xD0` | SENSOR_DATA + `FLAG_ALARM_ACK` + `FLAG_GLD_EXT_POWER` |

CH responses use `0x31` (`CLUSTER_DATA_RESPONSE`). `CH_HELLO` is `0x33`.

## MQTT topic map (Gateway ⇄ Broker ⇄ Server)

| Topic | Direction | Purpose |
|---|---|---|
| `gld/gateway/uplink` | Gateway → Server | Primary MESH frame source (JSON-wrapped frame hex) |
| `gld/gateway/raw` | Gateway → Server | Alternative/debug input |
| `pertamina/gld/uplink` | Gateway → Server | Legacy-compat topic |
| `gld/gateway/status` | Gateway → Server | Health, every ~10s |
| `gld/gateway/cmd/pull` | Server → Gateway | Pull request: `{ "requestId": 1, "hopList": ["0x0064"] }` |
| `gld/gateway/cmd/node` | Server → Gateway | Downlink to a GLD via CH: `{ "cluster": "0x0064", "node": "0xF001", "id": 1, "ttl": 600, "hex": "..." }` |
| `gld/server/decoded` | Server-internal/out | Successfully decrypted normal/recovery events |
| `gld/server/alarm` | Server-internal/out | Validated, production-eligible alarm events only |
| `gld/gateway/error` | Server-internal/out | Parse/decrypt/validation failures |
| `gld/gateway/events` | Server-internal/out | Raw parsed AppFrame envelope |

**Gateway uplink JSON shape** (from `gw-server/design.md`): `source`, `gatewayId`, `frameHex`, `frameLen`, `rssi`, `snr`, `parseStatus` (required); `typeFlags`, `msgType`, `srcId`, `dstId`, `seq`, `payloadLen` (optional).

**Decoded event JSON shape** (from `pertamina-gld-decode.js`):
```json
{
  "ok": true,
  "kind": "gld-event",
  "nodeIdHex": "0xF001",
  "gasClass": 1,
  "gasName": "lpg",
  "confidence": 80,
  "batteryMv": 3700,
  "alarm": false,
  "externalPower": false,
  "decryptOk": true
}
```

## Validation rules (server must reject, not store as production data)

- `gasClass` outside 0–6, or `=5` (reserved)
- `confidence > 100`
- `batteryMv == 0xFFFF`
- `payloadLen != 29`
- Unknown `keyId`
- AES-GCM tag verification failure

Failed events go to `gld/gateway/error`, never to `gld/server/alarm`.

## Deduplication

Recommended key: `clusterId + nodeId + GLDRecord.seq + eventKind`. Prevents duplicate processing of retried alarms / repeated pull responses. PertaminaGLD's bench computes the key but has no persistent dedup store yet — we will persist this in our own DB (see `server_integration_plan.md`).

## Gaps PertaminaGLD has not closed yet (don't assume these exist)

- No MySQL/production storage implementation (their planned tables: `gateway_frames`, `gld_events`, `gld_alarms`, `devices`, `commands` — informational only, we are not required to mirror table names since we use our own Prisma schema)
- No provisioning/commissioning for Gateway, CH, or GLD — WiFi/MQTT credentials are hardcoded in firmware (`config/gld-unified.env.example` shows the intended shape but firmware doesn't read it yet)
- No TLS / MQTT auth in the bench setup
- `ch-ch` (multi-hop CH-to-CH) design is a draft, not live-tested
- Per-RU / per-device AES key rotation is unaddressed — Phase 1 is a single global dummy key
