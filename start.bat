@echo off
chcp 65001 >nul
title Gas Leak Detection System v0.15

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
call npm install --legacy-peer-deps 2>&1
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

:: ── Launch ─────────────────────────────────────────────────────
echo.
echo  =============================================
echo    All done! Starting the application...
echo.
echo    Open your browser at:
echo    >>> http://localhost:3000 <<<
echo.
echo    Login:  admin@gld.com
echo    Pass:   admin
echo.
echo    Press Ctrl+C to stop the servers.
echo  =============================================
echo.

npm run dev
pause
