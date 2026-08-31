@echo off
echo ============================================
echo BVC Purchase Management System (Tauri Desktop)
echo ============================================
echo.
echo Starting Tauri Desktop App...
echo.

REM Get the directory where this batch file is located
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

echo.
echo Using: npm run tauri dev
echo This will build and launch the Tauri desktop app!
echo.
echo The app will open in a window.
echo Backend (Rust + SQLite) runs internally - no separate server needed.
echo.

REM Run Tauri development mode
start "BVC Tauri App" cmd /k "npm run tauri dev"

echo.
echo If the app doesn't open, make sure:
echo   1. Rust is installed: https://rustup.rs
echo   2. Node.js is installed
echo.
pause
