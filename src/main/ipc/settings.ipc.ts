import { ipcMain, BrowserWindow, app } from 'electron';
import { getSetting, setSetting, getAllSettings } from '../services/settings-service';
import { getDataDir, resetDataDirCache } from '../config/data-dir';

/**
 * 注册设置相关 IPC 处理器
 */
export function registerSettingsIpc(): void {
  ipcMain.handle('settings:get', (_event, key: string) => {
    return getSetting(key as any);
  });

  ipcMain.handle('settings:set', (_event, key: string, value: unknown) => {
    setSetting(key as any, value);
    // 开机自启需要同步更新系统登录项
    if (key === 'autoStart') {
      const isDev = !app.isPackaged;
      app.setLoginItemSettings({
        openAtLogin: value as boolean,
        // 使用绝对路径，避免开机时 Electron 在 System32 下查找入口文件
        args: isDev ? [app.getAppPath()] : [],
      });
    }
    return { success: true };
  });

  ipcMain.handle('settings:getAll', () => {
    return getAllSettings();
  });

  // 设置数据目录（需要重置缓存，重启后生效）
  ipcMain.handle('settings:setDataDir', (_event, dataDir: string) => {
    setSetting('dataDir', dataDir);
    resetDataDirCache();
    return { success: true };
  });

  // 获取当前数据存储路径
  ipcMain.handle('settings:getDataDir', () => {
    return getDataDir();
  });
}

/**
 * 注册窗口控制 IPC 处理器
 */
export function registerWindowIpc(): void {
  ipcMain.handle('system:minimize', () => {
    BrowserWindow.getFocusedWindow()?.minimize();
  });

  ipcMain.handle('system:maximize', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
      win.isMaximized() ? win.unmaximize() : win.maximize();
    }
  });

  ipcMain.handle('system:close', () => {
    BrowserWindow.getFocusedWindow()?.close();
  });
}
