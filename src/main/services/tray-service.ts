import { Tray, Menu, nativeImage, app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

/**
 * 系统托盘服务
 * 提供托盘图标、右键菜单、双击显示窗口
 */

let tray: Tray | null = null;

/**
 * 初始化系统托盘
 * @param onShowWindow 显示主窗口的回调
 * @param onQuit 退出应用的回调
 */
export function initTray(onShowWindow: () => void, onQuit: () => void): void {
  if (tray) return; // 已初始化

  const iconPath = getTrayIconPath();
  const icon = createTrayIcon(iconPath);

  tray = new Tray(icon);
  tray.setToolTip('DeskCanvas - AI 壁纸工具');

  // 双击托盘图标显示主窗口
  tray.on('double-click', () => {
    onShowWindow();
  });

  // 右键菜单
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => onShowWindow(),
    },
    { type: 'separator' },
    {
      label: '退出 DeskCanvas',
      click: () => onQuit(),
    },
  ]);

  tray.setContextMenu(contextMenu);
}

/**
 * 销毁托盘
 */
export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}

/**
 * 获取托盘图标路径
 */
function getTrayIconPath(): string {
  // 开发模式：build/icon.png
  const devPath = path.join(app.getAppPath(), 'build', 'icon.png');
  if (fs.existsSync(devPath)) return devPath;

  // 打包模式：icon.png 在 asar 根目录
  const prodPath = path.join(app.getAppPath(), 'icon.png');
  if (fs.existsSync(prodPath)) return prodPath;

  // 兜底：dist/main 同级（Vite 构建后）
  const distPath = path.join(__dirname, '..', '..', 'build', 'icon.png');
  if (fs.existsSync(distPath)) return distPath;

  return '';
}

/**
 * 创建托盘图标（缩放到 16x16）
 */
function createTrayIcon(iconPath: string): nativeImage {
  if (!iconPath) {
    // 无图标文件，创建一个 16x16 紫色方块作为占位
    return nativeImage.createEmpty();
  }

  const img = nativeImage.createFromPath(iconPath);
  if (img.isEmpty()) return img;

  // 缩放到 16x16（Windows 托盘标准尺寸）
  return img.resize({ width: 16, height: 16 });
}
