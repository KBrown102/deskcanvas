@echo off
chcp 65001 >nul
title DeskCanvas Dev Mode
cd /d "%~dp0"

echo ========================================
echo   DeskCanvas - Dev Mode (Hot Reload)
echo ========================================
echo.

if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo ERROR: npm install failed!
        pause
        exit /b 1
    )
)

echo Starting Vite dev server + Electron...
echo.
call npm run dev
