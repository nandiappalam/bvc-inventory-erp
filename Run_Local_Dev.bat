@echo off
echo ===================================================
echo   BVC ERP - Local Full-Stack Launcher (Windows)
echo ===================================================
echo.

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

echo [1/3] Starting Backend Server (Node.js + SQLite on Port 3001)...
start "BVC Backend Server" cmd /k "cd backend && set PORT=3001 && node server.js"

echo.
echo [2/3] Waiting 2 seconds for Backend to initialize...
timeout /t 2 /nobreak >nul

echo.
echo [3/3] Starting Frontend App (Vite Development Server on Port 3000)...
start "BVC Frontend UI" cmd /k "cd frontend && npm run dev"

echo.
echo ===================================================
echo  BVC ERP is running!
echo  Backend: http://localhost:3001
echo  Frontend: http://localhost:3000
echo ===================================================
echo.
pause
