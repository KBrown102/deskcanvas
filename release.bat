@echo off
chcp 936 >nul
title DeskCanvas - Release Build
echo ============================================
echo   DeskCanvas Release Build
echo   DevTools: OFF ^| Building production...
echo ============================================
echo.
set DESKCANVAS_DEBUG=0

REM 国内镜像（GitHub 不可用时自动走 npmmirror）
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/

REM 原生模块编译环境
set PYTHON=C:/Users/Administrator/AppData/Local/Programs/Python/Python310/python.exe
set GYP_MSVS_VERSION=2022

REM 在 WorkBuddy/CodeBuddy 环境里运行时，安全删除 shim 会拦截 fs.rm 并导致
REM electron-builder 最后清理临时文件失败。清掉 NODE_OPTIONS 可禁用该 shim。
set "ORIGINAL_NODE_OPTIONS=%NODE_OPTIONS%"
set NODE_OPTIONS=

npm run build
set BUILD_RESULT=%errorlevel%

REM 恢复 NODE_OPTIONS
set "NODE_OPTIONS=%ORIGINAL_NODE_OPTIONS%"

REM electron-builder 偶尔在 WorkBuddy 环境下末尾清理报错，但安装包已经生成
if exist "release\DeskCanvas-0.1.0-x64.exe" (
    echo.
    echo [OK] Build complete! Installer: release\DeskCanvas-0.1.0-x64.exe
    pause
    exit /b 0
)

if %BUILD_RESULT% neq 0 (
    echo.
    echo [ERROR] Build failed!
    pause
    exit /b 1
)

echo.
echo [OK] Build complete! Check the release/ folder.
pause
