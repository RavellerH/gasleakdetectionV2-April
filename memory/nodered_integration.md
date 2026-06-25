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

Each RU's local server install now runs **three processes**, all launched by `start.sh`/`start.bat`:
1. NestJS (port 4000)
2. Next.js (port 3000)
3. Node-RED + embedded Aedes broker (admin UI port 1880, MQTT port 1884)

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

## Install/start scripts (2026-06-25)

`nodered` was added to the root npm workspaces, and `start.sh`/`start.bat` now:
- create `nodered/.env` from `.env.example` on first run if missing, with a
  freshly-generated random AES-128 key (`openssl rand -hex 16` / PowerShell
  equivalent) as a placeholder so the bridge works out of the box for
  demos/dev — **this is not a real key**, see `open_items.md` #2 for the
  manual real-key process before going live with actual GLD hardware.
- launch `nodered` as a third background process (`npm run start` inside
  `nodered/`), alongside the existing backend/frontend processes, and
  include it in port-busy checks (1880, 1884) and shutdown/cleanup.

## Still needed

- Confirm the AppFrame-vs-raw-GLDRecord framing assumption above once real gateway firmware/hardware is available to test against.
