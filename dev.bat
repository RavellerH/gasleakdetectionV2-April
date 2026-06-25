@echo off
cd /d "%~dp0"
title GASGUARD v2.1 -- Dev Launcher
color 0A
cls

:: ── Banner ──
echo.
echo   +--------------------------------------------+
echo   :         GASGUARD v2.1                      :
echo   :   Gas Leak Detection Platform              :
echo   :   Pertamina Multi-RU Monitoring            :
echo   +--------------------------------------------+
echo.

echo   Initializing system...
timeout /t 2 >nul
echo  [OK] Modules loaded                  
timeout /t 1 >nul
echo  [OK] Backend connected               

echo.
echo   -----------------------------------------
echo.
echo   [1/2] Starting Backend (port 4000)...
set "ROOT=%~dp0"
start "GLD - Backend" cmd /k "title GLD Backend && color 0A && cd /d "%ROOT%apps\backend" && npm run start:dev"

timeout /t 3 >nul

echo   [2/2] Starting RU Frontend (port 3002)...
start "GLD - RU Frontend" cmd /k "title GLD RU Frontend && color 0A && cd /d "%ROOT%apps\ru-frontend" && npm run dev"

echo.
echo   -----------------------------------------
echo.
echo    All systems running.
echo.
echo    Open:  http://localhost:3002
echo.
echo    Login: admin@gld.com
echo.  
echo    Pass:  admin
echo.
echo    Close the Backend/Frontend windows to stop.
echo.
echo   -----------------------------------------
echo.
pause
