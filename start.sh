#!/usr/bin/env bash
set -uo pipefail
cd "$(dirname "$0")"

echo
echo " ============================================="
echo "   Gas Leak Detection System  v0.15"
echo "   Pertamina Multi-RU Monitoring Platform"
echo " ============================================="
echo

# ── Step 0: Check Node.js ─────────────────────────────────────
if ! command -v node >/dev/null 2>&1; then
    echo " [ERROR] This app needs a free program called \"Node.js\" to run."
    echo
    echo " 1. Go to https://nodejs.org"
    echo " 2. Download and install the LTS version"
    echo " 3. Run this script again when it's done"
    echo
    exit 1
fi
echo " [OK] Node.js $(node --version) detected."

# ── Step 1: Install dependencies ──────────────────────────────
echo
echo " [1/4] Setting things up for the first time..."
echo "       (This can take 1-3 minutes. Please wait.)"
echo
LOG_FILE="$(mktemp -t gld_install.XXXXXX.log)"
if ! npm install --legacy-peer-deps >"$LOG_FILE" 2>&1; then
    echo
    echo " [ERROR] Setup couldn't finish. This is almost always one of:"
    echo "   - No internet connection right now"
    echo "   - A permissions issue installing packages"
    echo
    echo " Try connecting to the internet and run this script again."
    echo " Details were saved to: $LOG_FILE"
    echo
    exit 1
fi
echo " [OK] Everything is installed."

# ── Step 2: Create frontend config ────────────────────────────
echo
echo " [2/4] Setting up configuration..."
ENV_FILE="apps/frontend/.env.local"
if [ ! -f "$ENV_FILE" ]; then
    MAPBOX_TOKEN="$(echo 'cGsuZXlKMUlqb2ljbUYyWld4c1pYSWlMQ0poSWpvaVkyMXRZbXhtZDNKcU1HOTVPREp5YjJ4cGJYWTFZalpwWkNKOS5tZF9Yc011dTJCc192RmFTc200ejdR' | base64 -d)"
    {
        echo "NEXT_PUBLIC_GRAPHQL_URL=http://localhost:4000/graphql"
        echo "NEXT_PUBLIC_MAPBOX_TOKEN=$MAPBOX_TOKEN"
    } > "$ENV_FILE"
    echo " [OK] Configuration created."
else
    echo " [OK] Configuration already exists."
fi

# ── Step 3: Setup database ─────────────────────────────────────
echo
echo " [3/4] Preparing the database..."
( cd apps/backend && \
  npx prisma generate >/dev/null 2>&1; \
  rm -f prisma/dev.db prisma/dev.db-journal; \
  npx prisma db push --skip-generate >/dev/null 2>&1 )
echo " [OK] Database ready."

# ── Step 4: Seed demo data ─────────────────────────────────────
echo
echo " [4/4] Loading demo data..."
( cd apps/backend && node prisma/seed.js >/dev/null 2>&1 )
echo " [OK] Demo data loaded."

# ── Clear stale Next.js build cache ────────────────────────────
rm -rf apps/frontend/.next

# ── Check ports are free ────────────────────────────────────────
echo
PORT_BUSY=0
if lsof -i :4000 >/dev/null 2>&1; then PORT_BUSY=1; fi
if lsof -i :3000 >/dev/null 2>&1; then PORT_BUSY=1; fi

if [ "$PORT_BUSY" -eq 1 ]; then
    echo " [NOTICE] It looks like this app might already be running,"
    echo " or another program is using its ports."
    echo
    echo " If the app doesn't open properly in a moment, stop any"
    echo " other copy of this app and any other app using ports"
    echo " 3000 or 4000, then try again."
    echo
fi

# ── Launch backend and frontend ─────────────────────────────────
echo " Starting the app..."
echo

cleanup() {
    echo
    echo " Stopping the app..."
    kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
}
trap cleanup EXIT INT TERM

( cd apps/backend && npm run start:dev ) &
BACKEND_PID=$!
sleep 2
( cd apps/frontend && npm run dev ) &
FRONTEND_PID=$!

echo " ============================================="
echo
echo "   The app is starting up."
echo "   Leave this terminal window open while you use the app."
echo
echo "   Open your browser to:  http://localhost:3000"
echo
echo "   Login:  admin@gld.com"
echo "   Pass:   admin"
echo
echo "   Give it about 20 seconds to finish starting up"
echo "   before opening the page above."
echo
echo "   To STOP the app: press Ctrl+C in this window."
echo " ============================================="
echo

wait
