# VPS Gateway Aggregator (apps/gateway) — Work-in-Progress

> Session note. Captured 2026-08-02 from uncommitted work by Claude.
> Status: builds clean; sync pipeline written but not yet runnable end-to-end.

## What was built (uncommitted)

### `apps/gateway/` — new NestJS service (port 4100)
- **Purpose:** VPS host aggregates every RU's local backend into one read-only
  GraphQL API for the HQ frontend. RUs remain the only writers.
- `src/modules/sync/sync.service.ts` — `@Cron` (default every 30s, override
  `SYNC_CRON_EXPRESSION`) loops over `RuSource` rows and calls each RU's new
  `gatewayPull` query with header `x-gateway-key`. Upserts devices, bulk-inserts
  readings/event logs (with per-row upsert fallback), advances `lastSyncAt` to the
  RU's `serverTime`, records `lastError` on failure. Re-entrancy guarded by `running`.
- `src/modules/devices/device.service.ts` — read-only mirror of `apps/backend`
  DeviceService (dashboard stats, analytics, event logs, sensor timeline, settings,
  users, login, ruSites, devices). No mutations.
- `src/modules/devices/device.resolver.ts` — mirrors backend query shapes so
  `apps/frontend` needs only `NEXT_PUBLIC_GRAPHQL_URL` repointed. No mutations.
- `prisma/schema.prisma` — own SQLite DB: `RuSource` (id=RU2..RU7, baseUrl,
  apiKey, lastSyncAt, lastError), `GatewayUser` (HQ/global-admin only, not synced),
  plus aggregated `Device`, `GasReading`, `EventLog`, `SystemSettings`.

### Backend changes (apps/backend)
- `gatewayPull(since)` GraphQL query protected by `GatewayKeyGuard`
  (`gateway-key.guard.ts`) — header `x-gateway-key` must equal `GATEWAY_SYNC_KEY`
  (in `apps/backend/.env`, placeholder `"change-me-per-ru-site"`).
  Returns devices (+ latest reading each), readings, eventLogs since `since`,
  plus `serverTime`.
- `Device.updatedAt` added (`@updatedAt`) + migration
  `20260802000000_add_device_updated_at`. Devices are re-pulled when
  `updatedAt`/`registeredAt` > since.
- Prisma client output relocated to `generated/prisma-client`
  (`apps/backend/generated/`, gitignored; run `npx prisma generate` after clone).

### ru-frontend experiment (NOT part of gateway work)
- `apps/ru-frontend/src/components/DeviceMap.tsx` switched from local MapLibre
  tiles back to Mapbox GL (`mapbox://styles/mapbox/dark-v11`, sky atmosphere,
  buildings removed). Real token in gitignored `.env.local`.
- ⚠️ **Reverses merged commit 6b682ef** ("local map tiles via MapLibre — fixes
  flicker, removes Mapbox"). Decision needed: commit this direction or drop it.

## Verified (2026-08-02 continuation)
- `npm run build` passes in `apps/backend` and `apps/gateway`.
- Prisma clients generated in both `apps/*/generated/prisma-client`.
- **E2E proven**: seeded `RuSource` RU4 -> `http://localhost:4000/graphql`
  (apiKey = backend's `GATEWAY_SYNC_KEY`), started backend (4000) + gateway (4100).
  First tick: `Synced RU4: 57 devices, 4704 readings, 25 event logs`, `lastSyncAt`
  advanced, `lastError` null. Then inserted a fresh reading on the backend via
  `addReading`; next tick: `Synced RU4: 0 devices, 1 readings, 1 event logs` and
  gateway `gasReading` count went 4704 -> 4705. Gateway GraphQL served all
  aggregated devices (`ruSites`, `devices(ruId:"ALL")`).

## Gaps found + closed (continuation)
1. No seed for `RuSource` / `GatewayUser` -> added `apps/gateway/prisma/seed.ts`
   + `prisma db seed` (`prisma:seed` script). Reads `GATEWAY_RU_IDS`
   (default `RU4`), `GATEWAY_RU_BASE_URL` (default `http://localhost:4000/graphql`),
   `GATEWAY_SYNC_KEY` (default `change-me-per-ru-site`, must match each RU backend),
   `GATEWAY_ADMIN_EMAIL` (default `admin@gld.com`). Documented in `.env.example`.
2. E2E pull now exercised — see above.

## Still open
- VPS not provisioned yet. In production set `GATEWAY_RU_*` per RU host, run
  `prisma db seed` there, and point the HQ frontend at `http://<vps>:4100/graphql`
  (`NEXT_PUBLIC_GRAPHQL_URL`). Each RU backend keeps its own `GATEWAY_SYNC_KEY`.
- HQ frontend still points at `:4000` in dev — intentional until the gateway is
  the real upstream.
- Decide fate of the ru-frontend Mapbox experiment before push.
