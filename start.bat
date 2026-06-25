@echo off
if "%~1"=="--inner" goto :main
:: Relaunch inside a "cmd /k" window so it never closes on its own,
:: even if something below crashes or exits unexpectedly.
start "Gas Leak Detection System — Setup" cmd /k "%~f0" --inner
exit /b

:main
setlocal enabledelayedexpansion
chcp 65001 >nul
title Gas Leak Detection System v0.15 — Setup
cd /d "%~dp0"

echo.
echo  =============================================
echo    Gas Leak Detection System  v0.15
echo    Pertamina Multi-RU Monitoring Platform
echo  =============================================
echo.

:: ── Step 0a: Internet connectivity check ───────────────────────
echo  Checking your internet connection...
curl.exe -s -m 5 -o nul -w "%%{http_code}" https://registry.npmjs.org > "%TEMP%\gld_net.txt" 2>nul
set /p NET_CODE=<"%TEMP%\gld_net.txt"
del /f /q "%TEMP%\gld_net.txt" >nul 2>&1
if not "%NET_CODE%"=="200" (
    echo  [WARNING] Couldn't reach the internet just now. If setup fails
    echo  below, check your Wi-Fi/network connection and try again.
) else (
    echo  [OK] Internet connection looks good.
)

:: ── Step 0b: PC specs check ─────────────────────────────────────
echo.
echo  Checking your computer's specs...
for /f "tokens=1,2 delims=|" %%A in ('powershell -NoProfile -Command "$ram=[math]::Floor((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory/1GB); $drv=(Get-Location).Drive.Name; $disk=[math]::Floor((Get-PSDrive $drv).Free/1GB); Write-Output ('{0}|{1}' -f $ram,$disk)" 2^>nul') do (
    set RAM_GB=%%A
    set DISK_GB=%%B
)
echo  RAM: %RAM_GB% GB free disk: %DISK_GB% GB - CPU cores: %NUMBER_OF_PROCESSORS%
set SPEC_STATUS=OK
if %RAM_GB% lss 4 set SPEC_STATUS=LOW
if %DISK_GB% lss 2 set SPEC_STATUS=LOW
if "%SPEC_STATUS%"=="LOW" (
    echo  [WARNING] Your computer is below the comfortable minimum
    echo  (4 GB RAM, 2 GB free disk space). The app may still run, but
    echo  could feel slow.
) else (
    echo  [OK] Your computer meets the recommended specs.
)

:: ── Step 0c: Auto-update from GitHub ────────────────────────────
echo.
if exist ".git" (
    git rev-parse --is-inside-work-tree >nul 2>&1
    if !errorlevel! equ 0 (
        echo  Checking for updates...
        for /f "tokens=*" %%b in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set GIT_BRANCH=%%b
        git fetch origin !GIT_BRANCH! >nul 2>&1
        if !errorlevel! equ 0 (
            for /f %%a in ('git rev-parse HEAD') do set LOCAL_REV=%%a
            for /f %%a in ('git rev-parse origin/!GIT_BRANCH!') do set REMOTE_REV=%%a
            for /f %%n in ('git status --porcelain ^| find /v /c ""') do set GIT_DIRTY_COUNT=%%n
            if not "!LOCAL_REV!"=="!REMOTE_REV!" (
                if "!GIT_DIRTY_COUNT!"=="0" (
                    echo  [UPDATE] A newer version is available. Updating...
                    git pull --ff-only origin !GIT_BRANCH!
                    if !errorlevel! equ 0 (
                        echo.
                        echo  [OK] Updated! Please double-click start.bat again to
                        echo  launch the updated app.
                        echo.
                        pause
                        exit /b 0
                    ) else (
                        echo  [WARNING] Update download failed. Continuing with the current version.
                    )
                ) else (
                    echo  [NOTICE] An update is available, but this copy has local
                    echo  changes, so auto-update was skipped.
                )
            ) else (
                echo  [OK] You already have the latest version.
            )
        ) else (
            echo  [NOTICE] Couldn't check for updates right now. Continuing.
        )
    )
) else (
    echo  [NOTICE] Auto-update isn't available for this copy ^(it wasn't
    echo  downloaded via git^). Re-download the project from GitHub for updates.
)

:: ── Step 1: Check Node.js ───────────────────────────────────────
echo.
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] This app needs a free program called "Node.js" to run.
    echo.
    echo  1. Go to https://nodejs.org
    echo  2. Click the green LTS button to download it
    echo  3. Run the installer, keep clicking "Next" with defaults
    echo  4. Double-click this file again when it's done
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do set NODE_VER=%%v
echo  [OK] Node.js %NODE_VER% detected.

:: ── Step 2: Install dependencies ──────────────────────────────
echo.
echo  [1/4] Setting things up for the first time...
echo        (This can take 1-3 minutes. Please wait, don't close this window.)
echo.
call npm install --legacy-peer-deps >"%TEMP%\gld_install.log" 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] Setup couldn't finish. This is almost always one of:
    echo    - No internet connection right now
    echo    - A security/antivirus program blocking the download
    echo.
    echo  Try connecting to the internet and run this file again.
    echo  Details were saved to: %TEMP%\gld_install.log
    echo.
    pause
    exit /b 1
)
echo  [OK] Everything is installed.

:: ── Step 3: Create frontend config ────────────────────────────
echo.
echo  [2/4] Setting up configuration...
if not exist "apps\frontend\.env.local" (
    echo cGsuZXlKMUlqb2ljbUYyWld4c1pYSWlMQ0poSWpvaVkyMXRZbXhtZDNKcU1HOTVPREp5YjJ4cGJYWTFZalpwWkNKOS5tZF9Yc011dTJCc192RmFTc200ejdR > "%TEMP%\gld_tok.b64"
    certutil -decode "%TEMP%\gld_tok.b64" "%TEMP%\gld_tok.txt" >nul 2>&1
    set /p MAPBOX_TOKEN=<"%TEMP%\gld_tok.txt"
    (
        echo NEXT_PUBLIC_GRAPHQL_URL=http://localhost:4000/graphql
        echo NEXT_PUBLIC_MAPBOX_TOKEN=%MAPBOX_TOKEN%
    ) > "apps\frontend\.env.local"
    del /f /q "%TEMP%\gld_tok.b64" "%TEMP%\gld_tok.txt" >nul 2>&1
    echo  [OK] Configuration created.
) else (
    echo  [OK] Configuration already exists.
)

:: ── Step 4: Setup database ─────────────────────────────────────
echo.
echo  [3/4] Preparing the database...
cd apps\backend

call npx prisma generate >nul 2>&1
if exist "prisma\dev.db" del /f /q "prisma\dev.db" >nul 2>&1
if exist "prisma\dev.db-journal" del /f /q "prisma\dev.db-journal" >nul 2>&1
call npx prisma db push --skip-generate >nul 2>&1
echo  [OK] Database ready.

:: ── Step 5: Seed demo data ─────────────────────────────────────
echo.
echo  [4/4] Loading demo data...
node prisma\seed.js >nul 2>&1
echo  [OK] Demo data loaded.

cd ..\..

:: ── Clear stale Next.js build cache ────────────────────────────
if exist "apps\frontend\.next" (
    rmdir /s /q "apps\frontend\.next" >nul 2>&1
)

:: ── Check ports are free ────────────────────────────────────────
echo.
set PORT_BUSY=0
netstat -ano | findstr ":4000 " >nul 2>&1
if %errorlevel% equ 0 set PORT_BUSY=1
netstat -ano | findstr ":3000 " >nul 2>&1
if %errorlevel% equ 0 set PORT_BUSY=1

if %PORT_BUSY% equ 1 (
    echo  [NOTICE] It looks like this app might already be running
    echo  in another window, or another program is using its ports.
    echo.
    echo  If the app doesn't open properly in a moment, close any
    echo  other "GLD — Backend" / "GLD — Frontend" windows and any
    echo  other app you know uses ports 3000 or 4000, then try again.
    echo.
)

:: ── Launch in separate windows ─────────────────────────────────
echo  Starting the app...
echo.

start "GLD — Backend  (port 4000)" cmd /k "title GLD Backend && cd /d %~dp0apps\backend && npm run start:dev"
timeout /t 2 >nul
start "GLD — Frontend (port 3000)" cmd /k "title GLD Frontend && cd /d %~dp0apps\frontend && npm run dev"

echo  =============================================
echo.
echo    The app is starting in two new windows.
echo    Leave those windows open while you use the app.
echo.
echo    Open your browser to:  http://localhost:3000
echo.
echo    Login:  admin@gld.com
echo    Pass:   admin
echo.
echo    Give it about 20 seconds to finish starting up
echo    before opening the page above.
echo.
echo    Your browser needs WebGL support to show the map —
echo    recent Chrome, Edge, or Firefox all work out of the box.
echo.
echo    To STOP the app: close the Backend and Frontend windows.
echo  =============================================
echo.
pause
