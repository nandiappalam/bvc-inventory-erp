@echo off
echo ========================================
echo BVC Purchase Management - Build Script
echo ========================================
echo.

echo Building standalone MSI installer...
echo This will create a professional Windows installer.
echo.

cd /d "%~dp0"

echo Step 1: Checking npm dependencies...
if not exist "frontend\node_modules" (
    echo Installing frontend dependencies...
    cd frontend
    call npm install
    cd ..
)

echo.
echo Step 2: Building Tauri application...
call npm run tauri build

echo.
echo ========================================
echo Build Complete!
echo ========================================
echo.
echo The installer is located at:
echo   src-tauri\target\release\bundle\msi\
echo.
echo Copy the .msi file to any Windows PC and run it.
echo No additional installation required!
echo.
pause
