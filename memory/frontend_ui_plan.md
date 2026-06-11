# Frontend & UI Plan

**Source docs:** `plan.md` (v2.2 Enhancement Plan), `TODO-UI-UX.md` (Execution Plan), `Gas-Leak-Design-v2.1.md`

## Current Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 (App Router) |
| Styling | Tailwind CSS |
| Mapping | Mapbox GL JS + react-map-gl |
| Charts | Recharts |
| API client | graphql-request |
| Icons | Lucide React |
| State | React state + GraphQL hooks |

## Key Frontend Files

- `apps/frontend/src/components/GasLeakDashboard.tsx` — main dashboard (large, inline styles, needs refactor)
- `apps/frontend/src/components/DeviceMap.tsx` — Mapbox map component
- `gas-leak-dashboard.jsx` — root JSX component reference

## UI/UX Roadmap (from plan.md v2.2 + TODO-UI-UX.md)

### Phase 1 — Core Polish (Weeks 1–2)
- [ ] Tailwind CSS migration (replace inline styles in GasLeakDashboard.tsx and DeviceMap.tsx)
- [ ] Socket.io: replace 10s polling with WebSocket for instant readings + alerts
- [ ] Persistent dark/light mode (LocalStorage or user profile)
- [ ] i18n foundation: Indonesian (ID) + English (EN)

### Phase 2 — Safety & Reporting (Weeks 3–4)
- [ ] PDF incident reports for CRITICAL alarms
- [ ] CSV analytics export for compliance
- [ ] Browser push notifications for high-severity alerts (Web Push API)
- [ ] Calibration tracking: last calibration date + overdue alert (>6 months)

### Phase 3 — Advanced Visuals (Weeks 5–6)
- [ ] Thermal camera feed panel + snapshot on alarm
- [ ] Interactive mesh topology drag-and-drop
- [ ] Predictive battery analytics ("Days until replacement")
- [ ] Heatmap overlay on Unit Layout for gas concentration

## Component Extraction Plan (TODO-UI-UX.md)

Extract from GasLeakDashboard.tsx into `apps/frontend/src/components/ui/`:

| Component | What it extracts |
|---|---|
| `<Badge />` | statusColor, healthColor, batteryColor logic |
| `<Card />` | glassmorphism look (backdrop-filter, rgba borders) |
| `<Button />` | linear gradient buttons (primary / danger / ghost variants) |
| `<Input />` | consistent form styling |

## Tailwind Migration Strategy

Safe-rollback approach:
1. Git branch: `git checkout -b feature/ui-modernization`
2. File backup before each major component: `cp GasLeakDashboard.tsx GasLeakDashboard.tsx.bak`
3. Atomic commits after each successful migration
4. Test at breakpoints: 375px / 768px / 1440px

Target: GasLeakDashboard.tsx file size reduced ≥ 30% after migration.

## Map Layers (Mapbox GL JS)

1. RU Boundary (GeoJSON polygon)
2. Device Markers (drag-enabled, health-colored icons)
3. LoRa Mesh topology lines (RSSI-based thickness)
4. Thermal plume heatmap (animated)
5. Battery heatmap (low battery clusters = red)
6. Alert pins (severity-based)

## User Roles (from Gas-Leak-Design-v2.1.md)

| Role | Scope | Key Permissions |
|---|---|---|
| RU_Operator | Single RU | View map/alerts, acknowledge events |
| RU_Supervisor | Single RU | + Device registration, location updates, reports |
| RU_Admin | Single RU | + User management, maintenance scheduling |
| Global_Admin | All RUs | + System config, cross-RU analytics, ML models |

## Planned Production Dependencies

```bash
npm i mapbox-gl maplibre-gl chroma-js recharts zustand lucide-react
npm i @trpc/client @trpc/server @trpc/react-query
npx shadcn-ui@latest add table form button card dialog
```

## Performance Targets (from Gas-Leak-Design-v2.1.md)

| Metric | Target |
|---|---|
| MQTT → Map latency | < 1 second |
| GraphQL query p95 | < 100ms |
| Device registration | < 5 seconds |
| Map load time | < 2 seconds |
| Battery alert response | < 500ms |
| Concurrent devices | 1000+ |
| Concurrent users | 500+ |
