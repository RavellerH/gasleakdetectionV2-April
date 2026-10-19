@echo off
setlocal
cd /d "%~dp0"
title GLD Demo -- Digitalization Day
set "DEMO=%~dp0"
set "ROOT=%~dp0..\..\"

echo.
echo   GLD Dashboard Demo - Digitalization Day  (DATA SIMULASI)
echo   -------------------------------------------------------
echo.

if not exist "%ROOT%node_modules" (
  echo [1/6] Install dependensi aplikasi...
  pushd "%ROOT%" && call npm install && popd
) else echo [1/6] Dependensi aplikasi sudah ada.
if not exist "%DEMO%node_modules" (
  pushd "%DEMO%" && call npm install && popd
)

if not exist "%ROOT%apps\ru-frontend\public\tiles\manifest.json" (
  echo [1b] Unduh tile peta RU4 untuk mode offline (sekali, butuh internet)...
  pushd "%ROOT%apps\ru-frontend" && call npm run tiles -- RU4 && popd
  if errorlevel 1 echo      Gagal unduh tile - peta tetap jalan dengan latar polos atau OSM online.
)

echo [2/6] Build backend dan dashboard RU (sekali, 1-3 menit)...
pushd "%ROOT%apps\backend" && call npx prisma generate && call npm run build && popd
set "NEXT_PUBLIC_DEMO_MODE=true"
set "NEXT_PUBLIC_POLL_MS=3000"
set "NEXT_PUBLIC_RU_ID=RU4"
set "NEXT_PUBLIC_GRAPHQL_URL=http://127.0.0.1:4000/graphql"
pushd "%ROOT%apps\ru-frontend" && call npx next build && popd

echo [3/6] Reset database demo RU4...
pushd "%DEMO%" && call node reset-db.js && popd
if errorlevel 1 (
  popd
  echo.
  echo   Demo dibatalkan. Tutup jendela demo lama lalu jalankan ulang start-demo.bat.
  pause
  exit /b 1
)

echo [4/6] Broker MQTT demo (port 1884)...
start "GLD Demo - Broker" cmd /k "cd /d "%DEMO%" && node broker.js"
timeout /t 2 >nul

echo [5/6] Backend (port 4000) + dashboard RU (port 3002)...
start "GLD Demo - Backend" cmd /k "cd /d "%ROOT%apps\backend" && set MQTT_URL=mqtt://127.0.0.1:1884&& set DEVICE_OFFLINE_AFTER_SEC=20&& set RU_ID=RU4&& node dist/main.js"
start "GLD Demo - Dashboard" cmd /k "cd /d "%ROOT%apps\ru-frontend" && npx next start -p 3002"
timeout /t 8 >nul

echo [6/6] Skenario (Enter = langkah berikutnya)...
start "" http://localhost:3002
start "GLD Demo - Skenario" cmd /k "cd /d "%DEMO%" && node scenario.js"

echo.
echo   Buka http://localhost:3002  -  login demo@gld.local / demo-gld-2026
echo   Jalankan skenario dari jendela "GLD Demo - Skenario".
echo.
endlocal
