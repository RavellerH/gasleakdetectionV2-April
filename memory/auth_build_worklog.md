# Build and Authentication Worklog

> Timezone: Asia/Jakarta (UTC+07:00)  
> Started: 2026-08-02  
> Last updated: 2026-08-03 09:17:18 +07:00  
> State: active local work; not committed or pushed

> VPS audit added: 2026-08-03 15:51:09 +07:00 — see [VPS Audit 2026-08-03](vps_audit_2026-08-03.md). No VPS changes were made.

## Purpose

This log records the repository study, build-reproducibility remediation, GitHub tooling setup, and authentication/security implementation performed during the current work session. It is intended to make continuation and review possible without relying on chat history.

## 2026-08-02 — Repository study

- Inventoried the four workspaces: RU-local backend, HQ frontend, RU frontend, and VPS gateway aggregator.
- Reviewed root documentation, `memory/`, Prisma schemas, frontend clients, firmware sources, launch scripts, Dockerfiles, and Git history.
- Confirmed `main` was synchronized with `origin/main` before local edits.
- Identified the main outstanding risks: non-reproducible builds, email-only login, unguarded GraphQL operations, absent automated tests/CI, incomplete MQTT ingestion, gateway multi-RU identity collisions, stale deployment files, and firmware protocol ambiguity.

## 2026-08-02 — Build reproducibility tranche

### Changes made

- Added root `build`, `typecheck`, `prisma:generate`, and `verify` scripts.
- Added workspace typecheck scripts to all four apps.
- Added Prisma prebuild generation to backend and gateway.
- Excluded tracked `*.backup.ts` and `*.backup.tsx` files from frontend compilation.
- Corrected the RU MapLibre marker drag event type.
- Updated frontend Docker build contexts to include all workspace manifests required by the root lockfile.
- Updated the backend Dockerfile to copy generated Prisma runtime assets and expose port 4000.
- Added `public/.gitkeep` to both frontend applications because their Dockerfiles copy `public/`.
- Documented `npm run verify` in the root README.

### Validation completed

- Installed dependencies successfully with `npm install --legacy-peer-deps`.
- Generated backend and gateway Prisma clients.
- `npm run typecheck`: passed for all four workspaces.
- `npm run build`: passed for all four workspaces.
- `npm audit --omit=dev`: zero production vulnerabilities at that point.
- Docker image execution was not tested because Docker is not installed.

## 2026-08-03 — GitHub publishing preparation

- Installed GitHub CLI 2.97.0 using `winget`.
- Attempted browser-based GitHub authentication twice; it did not complete through the background terminal.
- No branch was created, no files were staged, no commit was created, and nothing was pushed.
- User decided to continue locally and push manually later.

## 2026-08-03 — Authentication and API security tranche

### Dependencies

- Added `jsonwebtoken` and its types to backend and gateway.
- Added explicit bcrypt and bcrypt types to gateway; backend already used bcrypt.
- Development/tooling dependency advisories remain to be reviewed. A fresh production-only audit is pending.

### Backend implementation

- Added `apps/backend/src/modules/auth/auth.ts` with 12-hour JWTs, bearer extraction, authenticated-user and ADMIN guards, and a separate `x-ingest-key` guard.
- Production rejects a missing or default JWT secret.
- GraphQL context now includes the verified user.
- GraphQL Playground and introspection are disabled in production.
- Added `token` to `LoginResult`.
- Protected operational queries with JWT authentication and administrative mutations with ADMIN authorization.
- Preserved `gatewayPull` under its existing `x-gateway-key` guard.
- Protected `addReading` with `DEVICE_INGEST_KEY`.
- Added the previously missing authenticated backend `ruSites` query.
- Implemented bcrypt password verification and transparent one-time upgrade of legacy plaintext passwords.
- New and updated passwords use bcrypt with 12 rounds.
- Activated five-attempt/15-minute login throttling and generic invalid-credential errors.
- Explicitly sanitize returned users so password data is never returned.
- Backend seed now hashes the demo admin password.
- Added JWT and ingestion-key development configuration/examples.

### Frontend implementation

- HQ and RU GraphQL clients now send passwords, receive JWTs, set bearer headers, and restore saved tokens.
- Both login forms now include a password field.
- Login persists a session only when both user and token are returned.
- Logout clears user data, JWT data, and the client authorization header.
- Session restore requires both user and token.
- Non-admin dashboards do not request the ADMIN-protected user list.
- Added explicit temporary-password inputs for dashboard-created users; removed hidden `dev` defaults.
- HQ admin layout restores the bearer token before admin access.

### Gateway implementation

- Added gateway JWT utilities and authenticated/admin guards.
- Gateway GraphQL context verifies bearer tokens.
- Protected aggregated operational queries; the user list requires ADMIN.
- Gateway login now requires a password and returns a JWT, preserving HQ frontend compatibility.
- Added throttling, bcrypt verification, and transparent legacy-password upgrade.
- Added `GatewayUser.password` and migration `20260803000000_add_gateway_user_password`.
- Gateway seed hashes `GATEWAY_ADMIN_PASSWORD` for new users.
- Added JWT/admin-password environment documentation.
- Disabled gateway GraphQL Playground and introspection in production.

### Utility scripts

- Updated `simulate-sensors.js` from stale port/PPM fields to port 4000, confidence/AI fields, and `x-ingest-key`.
- Updated `test-api.js` to log in and use its bearer token.
- Updated `apps/backend/test-login.js` to request the JWT.

### Validation completed

- Regenerated both Prisma clients successfully.
- `npm run typecheck` passed for all four workspaces after authentication changes.
- Applied gateway migrations locally: initial gateway migration and password migration.

## 2026-08-03 09:17:18 +07:00 — Interrupted operation

- Gateway Prisma seed was attempted for runtime authentication testing.
- The sandboxed attempt failed on Prisma engine checksum network access.
- The escalated retry was interrupted by the user before completion.
- Post-interruption database check returned `gateway_users=0`.
- The gateway local database is migrated but **not seeded**.
- Windows denied process enumeration, so no successful background seed should be assumed.

## Current validation status

| Check | Status |
|---|---|
| Build tranche typecheck | Passed, all four apps |
| Build tranche production builds | Passed, all four apps |
| Auth tranche Prisma generation | Passed |
| Auth tranche typecheck | Passed, all four apps |
| Gateway password migration | Applied locally |
| Gateway seed | Not completed; zero gateway users |
| Auth tranche production builds | Pending |
| Backend runtime login test | Pending |
| Gateway runtime login test | Pending |
| Unauthorized-query and role-guard tests | Pending |
| Production dependency audit after auth additions | Pending |
| Docker builds | Not run; Docker unavailable |

## Important remaining security work

- Implement RU tenant isolation in addition to authentication and role checks:
  - reject cross-RU query arguments;
  - scope global dashboard statistics;
  - scope RU administrator user lists;
  - verify device ownership/RU before update or deletion.
- Replace all development secrets for deployment.
- Decide between browser JWT persistence and HTTP-only cookie/session architecture.
- Add password reset/change flow and token revocation if required.
- Replace in-memory email throttling with request/IP-aware distributed rate limiting.
- Add automated authentication, authorization, and tenant-boundary tests.

## Exact next steps

1. Seed the gateway database and confirm an HQ admin exists.
2. Run production builds for all four workspaces.
3. Runtime-test successful/failed login, legacy hash upgrade, unauthenticated rejection, ADMIN guards, gateway pull key, and ingestion key.
4. Run `npm audit --omit=dev`.
5. Implement RU tenant isolation.
6. Fix gateway multi-RU identity collisions and update propagation.
7. Review the complete diff; user will commit and push manually.

## Working-tree note

- All listed changes are local and uncommitted.
- The worktree contains both the completed build tranche and the in-progress authentication tranche.
- Generated Prisma clients and local SQLite databases are ignored.
- Do not discard or reset the worktree when continuing.
