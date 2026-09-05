@echo off
chcp 65001 >nul
title DeskCanvas Launcher
cd /d "%~dp0"

echo ========================================
echo   DeskCanvas - AI Wallpaper Creator
echo ========================================
echo.

if not exist "node_modules\" (
    echo [1/3] Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo ERROR: npm install failed!
        pause
        exit /b 1
    )
)

if not exist "dist\main\index.js" (
    echo [2/3] Building project...
    call npx vite build
    if errorlevel 1 (
        echo ERROR: Build failed!
        pause
        exit /b 1
    )
) else (
    echo [2/3] Build already exists, skipping...
)

echo [3/3] Launching DeskCanvas...
echo.
call npx electron .
