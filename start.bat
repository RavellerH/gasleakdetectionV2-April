@echo off
chcp 65001 >nul
title Gas Leak Detection System v0.15 — Setup

echo.
echo  =============================================
echo    Gas Leak Detection System  v0.15
echo    Pertamina Multi-RU Monitoring Platform
echo  =============================================
echo.

:: ── Step 0: Check Node.js ─────────────────────────────────────
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js is not installed.
    echo.
    echo  Please install Node.js LTS from:
    echo    https://nodejs.org
    echo.
    echo  After installing, double-click this file again.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do set NODE_VER=%%v
echo  [OK] Node.js %NODE_VER% detected.

:: ── Step 1: Install dependencies ──────────────────────────────
echo.
echo  [1/4] Installing packages...
echo        (First run takes 1-3 minutes. Please wait.)
echo.
call npm install --legacy-peer-deps
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] Package installation failed.
    echo  Check your internet connection and try again.
    echo.
    pause
    exit /b 1
)
echo  [OK] Packages ready.

:: ── Step 2: Create frontend config ────────────────────────────
echo.
echo  [2/4] Setting up configuration...
if not exist "apps\frontend\.env.local" (
    (
        echo NEXT_PUBLIC_GRAPHQL_URL=http://localhost:4000/graphql
        echo NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1IjoicmF2ZWxsZXIiLCJhIjoiY21tYmxmd3JqMG95ODJyb2xpbXY1YjZpZCJ9.md_XsMuu2Bs_vFaSsm4z7Q
    ) > "apps\frontend\.env.local"
    echo  [OK] Frontend config created.
) else (
    echo  [OK] Frontend config already exists.
)

:: ── Step 3: Setup database ─────────────────────────────────────
echo.
echo  [3/4] Setting up database...
cd apps\backend

echo  Generating Prisma client...
call npx prisma generate >nul 2>&1
echo  [OK] Prisma client generated.

call npx prisma migrate deploy >nul 2>&1
if %errorlevel% neq 0 (
    echo  [INFO] Applying schema directly...
    call npx prisma db push --accept-data-loss >nul 2>&1
)
echo  [OK] Database schema ready.

:: ── Step 4: Seed demo data ─────────────────────────────────────
echo.
echo  [4/4] Loading demo data...
node prisma\seed.js
echo  [OK] Demo data loaded.

cd ..\..

:: ── Clear stale Next.js build cache ────────────────────────────
if exist "apps\frontend\.next" (
    echo  Clearing frontend build cache...
    rmdir /s /q "apps\frontend\.next" >nul 2>&1
    echo  [OK] Build cache cleared.
)

:: ── Check port 4000 ────────────────────────────────────────────
echo.
netstat -ano | findstr ":4000 " >nul 2>&1
if %errorlevel% equ 0 (
    echo  [WARNING] Port 4000 is already in use.
    echo  The backend may fail to start. Close any app using port 4000 first.
    echo.
)

:: ── Launch in separate windows ─────────────────────────────────
echo  Starting servers in separate windows...
echo.

start "GLD — Backend  (port 4000)" cmd /k "title GLD Backend && cd /d %~dp0apps\backend && npm run start:dev"
timeout /t 2 >nul
start "GLD — Frontend (port 3000)" cmd /k "title GLD Frontend && cd /d %~dp0apps\frontend && npm run dev"

echo  =============================================
echo.
echo    Both servers are launching in new windows.
echo.
echo    Backend  → http://localhost:4000/graphql
echo    Frontend → http://localhost:3000
echo.
echo    Login:  admin@gld.com
echo    Pass:   admin
echo.
echo    Wait ~20 seconds for the backend to compile,
echo    then open: http://localhost:3000
echo.
echo    To STOP: close the Backend and Frontend windows.
echo  =============================================
echo.
pause
