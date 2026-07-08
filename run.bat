@echo off
if "%~1"=="--inner" goto :main
start "Gas Leak Detection System — Run" cmd /k "%~f0" --inner
exit /b

:main
setlocal enabledelayedexpansion
chcp 65001 >nul
title Gas Leak Detection System v0.15 — Quick Launch
cd /d "%~dp0"

echo.
echo  =============================================
echo    Gas Leak Detection System  v0.15
echo    Pertamina Multi-RU Monitoring Platform
echo  =============================================
echo.

:: Check if deps are installed, if not redirect to start.bat
if not exist "node_modules" (
    echo  Dependencies not found. Running full setup first...
    timeout /t 2 >nul
    call "%~dp0start.bat" --inner
    exit /b
)

:: Quick port check
set PORT_BUSY=0
netstat -ano | findstr ":4000 " >nul 2>&1
if %errorlevel% equ 0 set PORT_BUSY=1

if %PORT_BUSY% equ 1 (
    echo  [NOTICE] Backend may already be running.
)

:: ── Interactive launch menu ────────────────────────────────────
echo.
echo  =============================================
echo    What would you like to launch?
echo  =============================================
echo.
echo    [1] Backend + Frontend (http://localhost:3000)
echo    [2] Backend + RU Frontend (http://localhost:3002)
echo    [3] Backend + Both Frontends
echo    [Q] Quit
echo.
choice /c 123Q /n /m "  Enter your choice (1/2/3/Q): "
set LAUNCH_CHOICE=%errorlevel%

if "%LAUNCH_CHOICE%"=="4" (
    echo.
    echo  Goodbye!
    timeout /t 1 >nul
    exit /b 0
)

echo.
echo  Starting the app...
echo.

start "GLD — Backend  (port 4000)" cmd /k "title GLD Backend && cd /d %~dp0apps\backend && npm run start:dev"
timeout /t 3 >nul

if "%LAUNCH_CHOICE%"=="1" (
    start "GLD — Frontend (port 3000)" cmd /k "title GLD Frontend && cd /d %~dp0apps\frontend && npm run dev"
    set OPEN_URL=http://localhost:3000
)
if "%LAUNCH_CHOICE%"=="2" (
    start "GLD — RU Frontend (port 3002)" cmd /k "title GLD RU Frontend && cd /d %~dp0apps\ru-frontend && npm run dev"
    set OPEN_URL=http://localhost:3002
)
if "%LAUNCH_CHOICE%"=="3" (
    start "GLD — Frontend (port 3000)" cmd /k "title GLD Frontend && cd /d %~dp0apps\frontend && npm run dev"
    timeout /t 2 >nul
    start "GLD — RU Frontend (port 3002)" cmd /k "title GLD RU Frontend && cd /d %~dp0apps\ru-frontend && npm run dev"
    set OPEN_URL=http://localhost:3000
)

echo  =============================================
echo.
echo    The app is starting.
echo    Open your browser to:  %OPEN_URL%
echo.
echo    Login:  admin@gld.com  /  Pass:  admin
echo.
echo    Close the windows to stop.
echo  =============================================
echo.
pause
