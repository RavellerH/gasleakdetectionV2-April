@echo off
setlocal enabledelayedexpansion

echo [SYSTEM] Starting Gas Leak Detector Environment...

:: Check for root node_modules
if not exist "node_modules\" (
    echo [SYSTEM] Root node_modules not found. Installing dependencies...
    call npm install
)

:: Start Backend in a new window
echo [SYSTEM] Launching Backend (NestJS)...
start "Backend - Gas Leak Detector" cmd /c "title Backend && cd apps\backend && npm run start:dev"

:: Start Frontend in a new window
echo [SYSTEM] Launching Frontend (Next.js)...
start "Frontend - Gas Leak Detector" cmd /c "title Frontend && cd apps\frontend && npm run dev"

echo.
echo [SUCCESS] Both services are launching!
echo [INFO] Backend is usually on http://localhost:3000
echo [INFO] Frontend is usually on http://localhost:3001 (or 3000 if backend is down)
echo.
pause
