# DeskCanvas 强制清理脚本
# 由 cleanup.bat 调用

Write-Host "========================================"
Write-Host "  DeskCanvas - 强制清理所有壁纸效果"
Write-Host "========================================"
Write-Host ""

# 1. 关闭 DeskCanvas / Electron 进程
Write-Host "[1/3] 关闭 DeskCanvas 进程..."
Get-Process -Name electron -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process -Name DeskCanvas -ErrorAction SilentlyContinue | Stop-Process -Force
Write-Host "      已完成"

# 2. 清理临时壁纸文件
Write-Host "[2/3] 清理临时壁纸文件..."
$tempDir = Join-Path $env:APPDATA "deskcanvas\wallpapers\temp"
if (Test-Path $tempDir) {
    Remove-Item -Recurse -Force $tempDir
    Write-Host "      已清理临时文件"
} else {
    Write-Host "      无临时文件需要清理"
}

# 3. 重启 Explorer 重置 WorkerW 层级
Write-Host "[3/3] 重启资源管理器以清理 WorkerW 残留..."
Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Start-Process explorer.exe
Start-Sleep -Seconds 3
Write-Host "      Explorer 已重启"

Write-Host ""
Write-Host "  清理完成！桌面图标和壁纸应已恢复。"
Write-Host "  如果仍有异常，请等待几秒后右键桌面刷新。"
Write-Host ""
Read-Host "按回车键退出"
