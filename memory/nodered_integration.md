# Node-RED Integration

**Decision (2026-06-25):** Node-RED is the decode/decrypt bridge, kept as a separate process per RU local server (not absorbed into NestJS). This was a deliberate trade-off: fewer custom moving parts to maintain (reuse PertaminaGLD's existing, tested flow) at the cost of one extra process per RU install. NestJS subscribes only to already-decoded MQTT topics — see `server_integration_plan.md`.

This supersedes the previous version of this doc, which assumed Node-RED was a generic mixed-source normalizer (MQTT/HTTP/Serial/MySQL) writing into a MySQL staging table polled by NestJS. That MySQL staging layer is **dropped** — Node-RED now publishes decoded JSON directly back onto MQTT (`gld/server/decoded`, `gld/server/alarm`), and NestJS subscribes to that directly. No MySQL anywhere in this pipeline.

## Architecture

```
Gateway → MQTT (gld/gateway/uplink, .../status, .../raw)
              ↓
      Node-RED + embedded Aedes broker        (one process per RU)
      functions/pertamina-gld-decode.js        — AppFrame parse, AES-128-GCM decrypt, validate
              ↓ publish
      gld/server/decoded, gld/server/alarm, gld/gateway/error, gld/gateway/events
              ↓
      NestJS MqttConsumerService (subscribe only)
```

## Where this comes from

Start from PertaminaGLD's actual bench flow rather than building from scratch:
- `server/nodered/pertamina-gld-server.flow.json` — main server-side flow
- `server/nodered/functions/pertamina-gld-decode.js` — the decoder (AES-128-GCM, AppFrame/GLDRecord parsing, mesh topology state with TTL pruning)
- `server/nodered/.env.example` — `MQTT_HOST`, `MQTT_PORT` (1884 in their bench, 1883 unavailable there), `MQTT_USER`, `MQTT_PASS`, `GLD_KEY_ID`, `GLD_AES128_KEY_HEX`

Per-RU deployment: import their flow, point its broker config at `127.0.0.1` (Aedes runs embedded inside the same Node-RED process), and set this RU's real `GLD_AES128_KEY_HEX`/`GLD_KEY_ID` in its local `.env` — **never commit real keys**.

## What NestJS does NOT do

- No AES/crypto code
- No binary frame parsing (AppFrame, GLDRecord)
- No knowledge of LoRa mesh topology internals beyond what arrives in the decoded JSON

If Node-RED's decoded JSON envelope is missing a field NestJS needs (e.g. `seq`, `clusterId`, `rssi`, `snr` — see open item in `server_integration_plan.md` step 1), the fix is to extend the Node-RED flow/decoder function to include it, not to have NestJS re-parse raw frames itself.

## Per-RU process model

Each RU's local server install now runs **two processes**:
1. NestJS + Next.js (existing `start.sh`/`start.bat` entry point)
2. Node-RED (new — needs to be added to the install/start scripts, or documented as a manual prerequisite for V1)

This needs to be folded into `start.sh`/`start.bat` so a non-technical operator double-clicking the script still gets a fully working pipeline — currently those scripts only start NestJS+Next.js. **Open item**, see `open_items.md`.

## Implementation (2026-06-25)

Built under `nodered/` at repo root (sibling to `apps/`, since it's a separate
per-RU process, not part of the NestJS/Next.js workspaces):

- `nodered/functions/pertamina-gld-decode.js` — dependency-free decoder
  (`decodeGLDRecord`, `decodeGatewayFrame`) using Node's built-in `crypto`.
  Passes through `seq`, `clusterId`, `rssi`, `snr` from the gateway envelope
  onto every decoded event — closes the "still needed" item below.
- `nodered/functions/pertamina-gld-decode.test.js` — validates byte-for-byte
  against the test vector in `pertamina_gld_protocol.md`, plus tampered-tag
  and unknown-keyId rejection. Run with `npm test` inside `nodered/`.
- `nodered/settings.js` — starts an embedded Aedes broker in the same Node.js
  process as Node-RED (`node-red -s ./settings.js`) and exposes the decoder +
  this RU's AES key to flow function nodes via `functionGlobalContext`, so
  the real key is never pasted into the flow JSON.
- `nodered/flows/pertamina-gld-server.flow.json` — `gld/gateway/uplink` →
  decode function → route-by-ok/alarm function → publishes to
  `gld/server/decoded` / `gld/server/alarm` / `gld/gateway/error`.
- `nodered/.env.example`, `nodered/package.json`, `nodered/README.md`.

**Assumption not yet confirmed against real gateway firmware** (flagged in
code comments too): `frameHex` on `gld/gateway/uplink` is one or more
concatenated raw 34-byte GLDRecords, with no outer AppFrame header. If real
firmware wraps GLDRecords differently, strip that header before calling
`decodeGatewayFrame()` — the GLDRecord/AES-GCM layer itself doesn't need to
change.

## Still needed

- Decide how the per-RU AES key gets from "generated/assigned" to "in this RU's Node-RED `.env`" — process question, not purely technical (see `commissioning_mode.md` §6).
- Add Node-RED startup to `start.sh`/`start.bat`, or document it as a manual one-time setup step for V1.
- Confirm the AppFrame-vs-raw-GLDRecord framing assumption above once real gateway firmware/hardware is available to test against.
