#!/usr/bin/env bash
# Same as start-demo.bat for Linux/macOS. Ctrl+C stops everything.
set -euo pipefail
DEMO="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DEMO/../.." && pwd)"
LOG="$DEMO/logs"; mkdir -p "$LOG"

[ -d "$ROOT/node_modules" ] || (cd "$ROOT" && npm install)
[ -d "$DEMO/node_modules" ] || (cd "$DEMO" && npm install)

if [ ! -f "$ROOT/apps/ru-frontend/public/tiles/manifest.json" ]; then
  echo "[0] Unduh tile peta RU4 untuk mode offline (sekali, butuh internet)..."
  (cd "$ROOT/apps/ru-frontend" && npm run tiles -- RU4) || echo "    Gagal unduh tile - peta tetap jalan dengan latar polos atau OSM online."
fi

echo "[1/4] Build backend + dashboard RU..."
(cd "$ROOT/apps/backend" && npx prisma generate >/dev/null && npm run build >/dev/null)
(cd "$ROOT/apps/ru-frontend" && NEXT_PUBLIC_DEMO_MODE=true NEXT_PUBLIC_POLL_MS=3000 NEXT_PUBLIC_RU_ID=RU4 \
  NEXT_PUBLIC_GRAPHQL_URL=http://127.0.0.1:4000/graphql npx next build >/dev/null)

echo "[2/4] Reset database demo RU4..."
(cd "$DEMO" && node reset-db.js)

echo "[3/4] Broker, backend, dashboard..."
trap 'kill 0' EXIT
(cd "$DEMO" && node broker.js >"$LOG/broker.log" 2>&1) &
sleep 1
(cd "$ROOT/apps/backend" && MQTT_URL=mqtt://127.0.0.1:1884 DEVICE_OFFLINE_AFTER_SEC=20 RU_ID=RU4 node dist/main.js >"$LOG/backend.log" 2>&1) &
(cd "$ROOT/apps/ru-frontend" && npx next start -p 3002 >"$LOG/dashboard.log" 2>&1) &
sleep 8

echo "[4/4] Buka http://localhost:3002 — login demo@gld.local / demo-gld-2026"
cd "$DEMO" && node scenario.js "$@"
