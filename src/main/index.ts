import { app, BrowserWindow, shell, ipcMain, protocol, net } from 'electron';
import { join } from 'path';
import { registerAllIpcHandlers } from './ipc';
import { getDatabase, closeDatabase } from './database/db';
import { getWallpaperManager } from './wallpaper/wallpaper-manager';
import { initTray, destroyTray } from './services/tray-service';
import { getSetting, setSetting } from './services/settings-service';
import { getDataDir } from './config/data-dir';

// 禁用 GPU 加速以避免某些机器上的渲染问题（可选，按需开启）
// app.disableHardwareAcceleration();

let mainWindow: BrowserWindow | null = null;
let forceQuit = false; // true 时真正退出，false 时关窗口只最小化到托盘
let dialogShowing = false; // 防止重复触发关闭弹窗

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'DeskCanvas',
    // 无边框窗口，自定义标题栏
    frame: false,
    // 窗口标题栏样式（Windows）
    titleBarStyle: 'hidden',
    // 窗口标题栏叠加层（Windows）
    titleBarOverlay: {
      color: '#0F0F1A',
      symbolColor: '#F0F0F5',
      height: 36,
    },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // 需要访问文件系统，暂时关闭沙箱
      webSecurity: false, // 允许 <video>/<img> 直接加载 file:// 本地文件
    },
    // 背景色，避免加载时白屏
    backgroundColor: '#0F0F1A',
    show: false, // 先不显示，等 ready-to-show
  });

  // 页面加载完成后显示窗口，避免白屏闪烁
  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  // 外部链接用默认浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // 加载页面
  const rendererPath = join(__dirname, '../renderer/index.html');
  console.log('[Main] Loading renderer from:', rendererPath);

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(rendererPath);
  }

  // 页面加载调试
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[Main] Page loaded successfully');
  });
  mainWindow.webContents.on('did-fail-load', (_event, code, desc) => {
    console.error('[Main] Page load failed:', code, desc);
  });
  mainWindow.webContents.on('crashed', () => {
    console.error('[Main] Renderer crashed!');
  });

  // 仅 debug 模式打开 DevTools（通过 DESKCANVAS_DEBUG 环境变量控制）
  if (process.env.DESKCANVAS_DEBUG === '1') {
    mainWindow.webContents.openDevTools();
  }

  // 窗口关闭时：根据设置决定行为
  mainWindow.on('close', (e) => {
    if (forceQuit) {
      getWallpaperManager().cancelWallpaper();
      return;
    }

    e.preventDefault();
    const behavior = getSetting('closeBehavior') as string;

    if (behavior === 'tray') {
      mainWindow?.hide();
    } else if (behavior === 'quit') {
      forceQuit = true;
      mainWindow?.close();
    } else {
      // 'ask'：通知渲染进程显示自定义弹窗
      if (dialogShowing) return;
      dialogShowing = true;
      mainWindow?.webContents.send('window:show-close-dialog');
    }
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 应用就绪后创建窗口
app.whenReady().then(async () => {
  // 初始化数据库
  await getDatabase();
  console.log('[Main] Database initialized');

  // 注册 IPC 处理器
  registerAllIpcHandlers();
  console.log('[Main] IPC handlers registered');

  // 注册自定义协议，让渲染进程的 <video> / <img> 可以通过 local-file:// 协议加载本地文件
  protocol.handle('local-file', (request) => {
    const filePath = decodeURIComponent(request.url.replace('local-file://', ''));
    const fileUrl = `file:///${filePath.replace(/\\/g, '/')}`;
    return net.fetch(fileUrl);
  });
  console.log('[Main] local-file:// protocol registered');

  createWindow();

  // 初始化系统托盘：双击显示主窗口，右键菜单可退出
  initTray(
    () => { mainWindow?.show(); mainWindow?.focus(); },
    () => { forceQuit = true; mainWindow?.close(); },
  );

  // 处理渲染进程的关闭弹窗回传
  ipcMain.handle('window:close-response', (_event, action: string, remember: boolean) => {
    dialogShowing = false;
    if (remember && action !== 'cancel') {
      setSetting('closeBehavior', action);
    }
    if (action === 'tray') {
      mainWindow?.hide();
    } else if (action === 'quit') {
      forceQuit = true;
      mainWindow?.close();
    }
    // 'cancel' 不做任何操作
    return { success: true };
  });

  // macOS: 点击 Dock 图标重新创建窗口
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 应用退出前清理资源（before-quit 不等待 async，用 preventDefault + 二次 quit 保证清理完成）
app.on('before-quit', (e) => {
  if (!mainWindow) return; // 已在清理中，不再拦截
  e.preventDefault();
  mainWindow = null; // 防止二次拦截
  destroyTray();
  getWallpaperManager().cleanup().then(() => {
    closeDatabase();
    app.quit();
  });
});

// 所有窗口关闭时退出应用（Windows/Linux 行为）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
