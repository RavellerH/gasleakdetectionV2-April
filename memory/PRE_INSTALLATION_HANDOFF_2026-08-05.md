# GasGuard GLD Pre-installation Handoff

> **Authoritative as of:** 2026-08-05 15:38:34 +07:00 (Asia/Jakarta)  
> **Repository:** `gasleakdetectionV2-April`  
> **State:** preparation implemented locally; GLD/RU/VPS/HQ production install not started  
> **Next AI:** read this file first, then inspect `git status` and current source before changing anything  
> **Secrets:** deliberately omitted. Never copy chat passwords, sync keys, JWT secrets, database passwords, or MQTT credentials into Git.

## 1. Confirmed deployment decisions

These came from the operator and supersede older design documents:

| Decision | Accepted value |
|---|---|
| Sites | RU2, RU3, RU4, RU5, RU6, RU7 |
| RU runtime | Full RU stack runs locally at every RU |
| RU-to-VPS reachability | VPS can connect directly to every RU through a private VPN |
| VPS sync target | Every 30 seconds; must remain below 3 minutes |
| HQ UI | `apps/frontend` on the main HQ Windows computer |
| HQ startup | Windows scheduled task plus desktop shortcut |
| Exposure | VPN-only; no public GasGuard application endpoint |
| Domain/TLS | No domain yet; private VPN IP is acceptable during preparation |
| VPS database | PostgreSQL |
| Scale | About 10 sensor devices per RU |
| Telemetry behavior | Immediate event when gas is detected; otherwise approximately one heartbeat per 10 minutes |
| Central reading retention | Minimum 7 days |
| Backup destination | Not decided; local 7-day dump rotation prepared as a temporary baseline |
| HQ permissions | Data viewing only; mutation/admin controls disabled in the HQ build |
| Containers | Docker is allowed |
| Repository | Public; therefore no production secrets may be committed |

The user declined SSH-key conversion and disabling password SSH at this time.
Do not silently change that decision. The password previously shared in chat
must still be rotated before production use and must never be written here.

## 2. Authoritative architecture

```text
GLD detector nodes
  -> CH mesh
  -> physical PertaminaGLD Gateway
  -> authenticated/private MQTT broker
  -> PertaminaGLD Node-RED flow at that RU
  -> normalized MQTT topics
  -> this repo: apps/backend + RU SQLite database
  -> authenticated gatewayPull GraphQL over VPN
  -> this repo: apps/gateway + VPS PostgreSQL
  -> GraphQL over VPN
  -> this repo: apps/frontend, read-only, on HQ Windows
```

Important boundary: `fadlurrahmanf/PertaminaGLD` does **not** provide the
GraphQL RU backend expected by `apps/gateway`. Its production server boundary is
MQTT/Node-RED. A durable MQTT adapter in this repository's `apps/backend` is
still required between normalized Node-RED events and `gatewayPull`.

The central gateway is pull-only. HQ is view-only. No remote actuation or
device command path is included in this phase.

## 3. Repository study result

The repository was inventoried and its four active applications traced:

| Component | Purpose | Data store / port |
|---|---|---|
| `apps/backend` | Per-RU NestJS GraphQL API and `gatewayPull` source | SQLite, port 4000 |
| `apps/ru-frontend` | RU-local frontend | dev port 3002 |
| `apps/gateway` | Multi-RU NestJS GraphQL aggregation API | PostgreSQL, port 4100 |
| `apps/frontend` | HQ dashboard | Next.js, localhost port 3000 |

The repository contained 310 files when generated/build/vendor directories were
excluded. The local RU backend development database contained 57 devices, 4,704
readings, and 2 users. The old ignored gateway SQLite database contained zero
sources, users, devices, readings, and events. It was inspected read-only and no
production data migration was needed when converting the gateway schema to
PostgreSQL.

The `edge firmware/` tree is legacy reference material. Current GLD behavior
must be verified against the upstream PertaminaGLD revision recorded in
`ru_backend_pertaminagld_study_2026-08-05.md`, not inferred from older local
firmware or design documents.

## 4. Preparation implemented in this working tree

### VPS aggregate database and collision-safe synchronization

- Changed `apps/gateway/prisma/schema.prisma` from SQLite to PostgreSQL.
- Replaced the empty-development SQLite migrations with one PostgreSQL initial
  migration and a PostgreSQL migration lock.
- Added source IDs and composite RU uniqueness for devices, readings, and
  events. This prevents identical node IDs such as `0xF001` at different RUs
  from overwriting each other.
- Central entity IDs are namespaced as `<RU>:<sourceId>`.
- Synchronization now maps RU-local device IDs to central device IDs, including
  incremental pulls that contain readings without a repeated device row.
- Synchronization validates URLs and RU ownership, has a configurable 20-second
  request timeout, uses a transaction, records source errors, and applies
  duplicate-safe inserts.
- Seed configuration supports a distinct VPN GraphQL URL and sync key for every
  RU2-RU7. Placeholder URLs/keys are rejected.
- Gateway admin seed password must be at least 12 characters and cannot be the
  old demo password.

### Retention and health

- Added a daily retention task. Defaults: readings 7 days; noncritical events 7
  days; critical events 90 days. Devices, users, and source configuration are
  retained.
- Added `GET /health`, including database reachability and sanitized RU sync
  status. It remains degraded until all six RUs have synced successfully and
  does not expose source URLs or keys.
- Restricted gateway browser CORS to configured origins, defaulting to local HQ
  development origins instead of reflecting every origin.

### VPS deployment bundle

- Added `apps/gateway/Dockerfile`.
- Added `docker-compose.vps.yml` with PostgreSQL 16, persistent volume, private
  Docker network, health checks, conservative CPU/memory limits, and gateway
  binding only to `127.0.0.1:4100`.
- Added `deploy/vps/.env.example` for all non-secret variable names and
  placeholders. The real `.env` is ignored.
- Added an Nginx template that listens only on a placeholder WireGuard address
  and proxies to the loopback gateway.
- Added a PostgreSQL dump helper with 7-day local rotation. Its storage target,
  encryption, off-host copy, restore test, and scheduling are still undecided.
- Added `.dockerignore` to prevent secrets, databases, builds, and repository
  metadata entering the image context.

### HQ read-only deployment

- Added `NEXT_PUBLIC_READ_ONLY=true` support to `apps/frontend`.
- Read-only builds hide Settings, admin navigation, device registration/edit/
  deletion, event acknowledgement, and automatic client event-log writes.
- Admin routes redirect to the dashboard when read-only mode is enabled.
- Added `deploy/hq/run-hq-frontend.ps1` and
  `deploy/hq/install-hq-frontend.ps1`.
- The installer performs a clean install/build, creates a logon scheduled task,
  starts it, and creates a desktop shortcut.
- Next.js binds to `127.0.0.1:3000`, not the HQ LAN interface.

### Automation and documentation

- Added `.github/workflows/ci.yml` for clean dependency install, Prisma client
  generation, type checking, production builds, and generated-diff checks.
- Marked `docker-compose.dev.yml` historical/unsupported. It has stale ports,
  database assumptions, and frontend environment names and must not be used for
  deployment.
- Added this handoff, the PertaminaGLD source study, and the memory index link.
- Updated the root README with the prepared RU/VPS/HQ topology.

## 5. PertaminaGLD contract that must be implemented next

The studied upstream revision is
`f9749d95882f4000a016af4efc80a8605a16cfd2` from 2026-08-05.

Normalized topics required by `apps/backend` include:

| Topic | Required handling |
|---|---|
| `gld/server/decoded` | Persist authenticated non-alarm reading |
| `gld/server/alarm` | Persist reading and create alert/event immediately |
| `gld/server/topology` | Update gateway/CH/node relationships |
| `gld/gateway/status` | Update gateway connectivity/health |
| `gld/server/integrity` | Diagnostic/security event, not gas alarm |
| `gld/server/replay` | Diagnostic replay/nonce-reuse event |
| `gld/gateway/error` | Bridge/decode diagnostic event |
| `gld/server/test` | Quarantine or mark test; never count as production alarm |

Mapping constraints:

- `nodeIdHex` is the external device key.
- PertaminaGLD confidence is integer `0..100`; local `GasReading.confidence`
  expects `0.0..1.0`, so divide by 100.
- Preserve `receivedAt` instead of substituting ingestion time.
- Persist a stable source-event/deduplication identity. MQTT redelivery must not
  create duplicate readings or alarms.
- Preserve sequence, authenticated payload fingerprint/dedup key, battery mV,
  external power, Gateway ID, CH ID, and ingress class.
- Never invent PPM values. The current contract is gas class, confidence, alarm,
  risk, and device health.
- Add pagination/overlap safety to `gatewayPull`; the current `since` query is
  unbounded after a long outage.

This MQTT ingestion tranche is the primary blocker to a useful field install.
Without it, the VPS can only aggregate demo or manually inserted readings.

## 6. Validation evidence

Completed locally on Windows on 2026-08-05:

- `npm.cmd run prisma:generate`: passed for RU backend and gateway.
- `npm.cmd run typecheck`: passed for all four workspaces.
- Production `npm.cmd run build`: passed for all four workspaces using a dummy
  PostgreSQL URL, VPN-style frontend API URL, and read-only frontend mode.
- `npx prisma validate` for the gateway schema: passed.
- `git diff --check`: passed (only Git's expected LF-to-CRLF notices).
- Both HQ PowerShell scripts were parsed by PowerShell successfully.
- Upstream PertaminaGLD Node-RED JavaScript tests: 3 passed, 0 failed.
- Upstream dataset flow generator drift check: passed.
- Upstream main flow generator drift check: failed because checked-in flow and
  generator differ; upstream must resolve which is authoritative before field
  rollout.

Validation limitations:

- Docker is not installed on this workstation, so the Dockerfile and Compose
  stack were not built or executed locally.
- Bash is not installed here, so `deploy/vps/backup-postgres.sh` could not be
  syntax-checked locally. Run `bash -n` on the Ubuntu VPS before scheduling it.
- No PostgreSQL migration was applied to a real database.
- No VPN, broker, Node-RED, RU host, sensor, or VPS was changed in this work.
- There are no automated application tests/test scripts; verification is
  generation, static checking, build, and upstream Node-RED tests only.
- Spreadsheet content analysis could not be performed because the required
  workbook dependency-loader tool from the spreadsheet workflow was unavailable
  in this environment. Files were inventoried without modification.

## 7. Data/artifact inventory notes

The legacy firmware tree contains 12 `.xlsx` files: Board1, Board3-Board11, plus
two tracked Excel lock files (`Board1/~$Board1.xlsx` and
`Board5/~$Board5.xlsx`). Board8 has no `.tflite` beside it. Eight distinct
TFLite files exist for Boards 3, 4, 5, 6, 7, 9, 10, and 11. Their differing
hashes indicate board-specific artifacts and they must not be replaced with one
shared model without validation.

Before hardware rollout:

- inspect the workbook schemas and provenance with a compatible spreadsheet
  tool;
- decide whether the two tracked Excel lock files can be removed;
- verify each hardware board-to-model/scaler/feature-order mapping with labeled
  sensor data;
- resolve why Board1 and Board8 do not have the same checked-in TFLite pattern;
- preserve the original files and hashes during analysis.

## 8. Security and operational findings

- The repository is public. Tracked `.env` files contain only development or
  placeholder values; production secrets belong only in ignored runtime files.
- `npm audit --omit=dev` reported 26 production dependency findings on
  2026-08-05: 11 high, 15 moderate, 0 critical. Perform a controlled dependency
  upgrade and regression pass before production deployment. Do not blindly run
  a force upgrade.
- CORS on the per-RU backend still reflects all origins. Restrict it to the
  RU-local UI or remove browser access where the backend is server-to-server.
- RU SQLite retention and backup policy do not yet exist.
- MQTT needs authentication, per-topic authorization, and TLS or a secured
  private network. Node-RED administration must not be public.
- Authentication is application-level JWT/password. Older notes claiming no
  authentication or proposing Keycloak are historical.
- The previously audited VPS has sufficient capacity but hosts many unrelated
  workloads. Keep GasGuard in `/home/homeauto/gasguard`, use resource limits,
  and do not edit the existing `/home/homeauto/home-automation` stack.
- During the read-only VPS audit, ports 4000 and 4100 were free; ports 3000 and
  3002 were occupied. PostgreSQL was already listening on loopback, but this
  prepared Compose stack uses its own named-volume database container.
- Existing public listeners included SSH, Node-RED, Portainer, XRDP, and other
  services. Firewall state could not be verified without successful root audit.
  Confirm provider firewall and UFW/nftables before attaching RU VPN peers.
- The existing VPS Nginx root route must not be overwritten.

## 9. Required information before installation

Do not invent these values:

1. WireGuard subnet and the final private IP for VPS, HQ, and each RU2-RU7.
2. Whether Tailscale already on the VPS will be used instead of WireGuard.
3. Each RU backend's VPN GraphQL URL.
4. A distinct RU-to-VPS `GATEWAY_SYNC_KEY` for every RU.
5. VPS PostgreSQL password, JWT secret, and HQ admin password generated outside
   Git.
6. MQTT broker location at each RU, TLS/auth model, topic ACLs, and Node-RED
   deployment owner.
7. RU local computer OS, addresses, service manager, and disk/backup capacity.
8. Final central backup location, encryption, retention, and restore-test owner.
9. Alert policy and whether HQ needs any notification channel beyond viewing.
10. Maintenance window for VPS firewall/security changes and dependency updates.

## 10. Safe continuation order

1. Implement and test the normalized MQTT ingestion module in `apps/backend`.
2. Add ingestion idempotency/source metadata and `gatewayPull` pagination.
3. Add automated unit/integration tests for confidence conversion, duplicate
   delivery, RU collision isolation, cursor restart, retention, and read-only UI.
4. Resolve the upstream Node-RED flow drift and validate actual model/scaler data.
5. Create a dedicated RU deployment bundle including broker/Node-RED/backend/
   RU frontend persistence, health checks, retention, and backups.
6. Upgrade vulnerable dependencies conservatively and repeat full verification.
7. Collect the missing private network and RU host values.
8. On the VPS, perform a new read-only audit, confirm host fingerprint/firewall,
   then create `/home/homeauto/gasguard` without touching the existing stack.
9. Run `bash -n deploy/vps/backup-postgres.sh` and
   `docker compose --env-file deploy/vps/.env -f docker-compose.vps.yml config`.
10. Start PostgreSQL and gateway, apply migration/seed through container startup,
    verify `/health`, verify six sources, and test one RU at a time.
11. Install the HQ frontend only after the VPN API is reachable from HQ. Confirm
    that mutation/admin controls are absent and port 3000 is loopback-only.
12. Perform a restore drill and a simulated gas event end-to-end before field
    acceptance.

Suggested local verification commands for the next agent:

```powershell
git status --short
npm.cmd ci
npm.cmd run prisma:generate
npm.cmd run typecheck
$env:DATABASE_URL='postgresql://gasguard:dummy@localhost:5432/gasguard?schema=public'
$env:NEXT_PUBLIC_GRAPHQL_URL='http://10.77.0.1/graphql'
$env:NEXT_PUBLIC_READ_ONLY='true'
npm.cmd run build
npm.cmd audit --omit=dev
git diff --check
```

Do not apply Prisma migrations against an existing database until its contents
and backup are known. The gateway's earlier SQLite migration history was
replaced because its ignored local database was empty; an unknown deployed
gateway database would require a deliberate migration plan.

## 11. Current Git/worktree context

Starting HEAD for this preparation was `801a930` on `main`. Earlier committed
work includes authentication and gateway foundation changes. This preparation
is intentionally left uncommitted for the user to review and push personally.

Expected modified/new areas include:

- `.github/workflows/ci.yml`
- `.dockerignore`, `.gitignore`
- `apps/gateway` Prisma, seed, sync, health, retention, environment, Dockerfile
- `apps/frontend` read-only UI and environment example
- `deploy/vps`, `deploy/hq`
- `docker-compose.vps.yml`
- historical warning in `docker-compose.dev.yml`
- root README and `memory/`

Use `git diff`, including untracked files, before committing. Preserve unrelated
user changes and never commit real `.env` files or database files.

## 12. Timestamped work log

### 2026-08-05 14:39 +07:00 - upstream study

- Studied the public PertaminaGLD repository at the pinned revision.
- Ran its available Node-RED JavaScript tests and flow drift checks.
- Compared its MQTT contract with local `apps/backend` and `apps/gateway`.
- Wrote `ru_backend_pertaminagld_study_2026-08-05.md`.

### 2026-08-05 14:50-15:25 +07:00 - repository and design audit

- Inventoried source, documentation, firmware artifacts, workspaces, databases,
  environment files, deployment files, and Git state.
- Traced authentication, GraphQL, database, sync, and frontend mutation paths.
- Identified cross-RU ID collision and incremental foreign-key failure risks.
- Identified stale Compose/docs, missing MQTT ingestion, retention, health,
  backup, CI, VPN deployment, and read-only HQ behavior.
- Inspected local database counts without changing data.
- Invoked the spreadsheet analysis workflow because the repository contains
  `.xlsx` data; its required dependency loader was unavailable, so only
  file/hash inventory was completed and the limitation was recorded.

### 2026-08-05 15:00-15:32 +07:00 - implementation

- Migrated the central gateway design to PostgreSQL.
- Made sync IDs/cursors safe across all RU2-RU7 and added retention/health.
- Added distinct per-RU source configuration and placeholder rejection.
- Added VPS Docker/Compose, private Nginx, environment, and backup preparation.
- Added explicit HQ read-only behavior and Windows startup/shortcut scripts.
- Added CI and deployment documentation.
- Performed generation, schema validation, type checking, production builds,
  PowerShell parsing, audit, and diff checks.
- Did not connect to or mutate the VPS, any RU, MQTT broker, hardware, or
  production database.

### 2026-08-05 15:33 +07:00 - handoff consolidation

- Confirmed Axios is retained because `apps/backend/test-login.js` uses it.
- Confirmed Bash and Docker validation are unavailable on this workstation.
- Marked the stale development Compose file unsupported.
- Created this authoritative memory file and linked it from the README and
  memory index so another AI can continue without relying on chat history.

### 2026-08-05 15:38 +07:00 - final readiness pass

- Changed health status to remain degraded until every RU2-RU7 has completed a
  successful synchronization.
- Added conservative CPU/memory limits and `no-new-privileges` to the prepared
  VPS containers where applicable.
- Re-ran Prisma generation and validation, all-workspace TypeScript checks, HQ
  PowerShell parsing, and Git whitespace validation; all passed.
