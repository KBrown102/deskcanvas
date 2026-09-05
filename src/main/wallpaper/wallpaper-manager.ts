import { app, BrowserWindow, screen } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { WallpaperRepository } from '../database/repositories/wallpaper.repo';
import type { Wallpaper } from '../../shared/types';

/**
 * 壁纸管理总控
 * 统一管理图片壁纸和 HTML 动态壁纸的设置、切换、取消
 *
 * 架构说明：
 * - 所有壁纸（图片 / 单 HTML / HTML 目录包）→ WorkerW 背景层注入（桌面图标下方）
 * - 工具绝不修改 HTML 内容，原样加载
 */
export class WallpaperManager {
  private wallpaperRepo: WallpaperRepository;
  private currentWallpaper: Wallpaper | null = null;
  private wallpaperWindow: BrowserWindow | null = null;
  /** 应用启动时记录的系统壁纸路径，用于退出时还原 */
  private originalWallpaperPath: string | null = null;
  /** 是否已注入 WorkerW（用于 cleanup 时判断是否需要脱离） */
  private isInjected = false;

  constructor() {
    this.wallpaperRepo = new WallpaperRepository();
  }

  /**
   * 设置图片壁纸
   * 创建透明窗口显示图片，注入 WorkerW 背景层（图标下方）
   */
  async setImageWallpaper(wallpaperId: string, _style?: string): Promise<{ success: boolean; error?: string }> {
    const wallpaper = await this.wallpaperRepo.findById(wallpaperId);
    if (!wallpaper) return { success: false, error: '壁纸记录不存在' };
    if (wallpaper.type !== 'image') return { success: false, error: '该壁纸不是图片类型' };
    if (!fs.existsSync(wallpaper.filePath)) return { success: false, error: '壁纸文件不存在' };

    this.closeCurrentWindow();

    try {
      // 首次设置壁纸时，记录当前系统壁纸路径（用于退出还原）
      if (!this.originalWallpaperPath) {
        const { getWallpaperPath } = await import('../native/workerw');
        this.originalWallpaperPath = getWallpaperPath();
        console.log('[WallpaperManager] Original wallpaper saved:', this.originalWallpaperPath);
      }

      // 通过文件头魔数检测真实 MIME 类型（AI 生成的图片扩展名可能与实际格式不符）
      const imgBuffer = fs.readFileSync(wallpaper.filePath);
      const mime = this.detectImageMime(imgBuffer);

      // 写临时 HTML 文件引用原图（避免 data URL 过长导致 loadURL 失败）
      const tmpDir = path.join(app.getPath('temp'), 'deskcanvas');
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      const tmpHtmlPath = path.join(tmpDir, 'wallpaper.html');
      // 使用 file:// 协议引用原图，需要 URL encode 路径
      const imgUrl = wallpaper.filePath.replace(/\\/g, '/');
      const html = `<!DOCTYPE html><html><head><style>
        *{margin:0;padding:0}
        html,body{width:100%;height:100%;overflow:hidden;background:#000}
        img{width:100%;height:100%;object-fit:cover;display:block}
      </style></head><body><img src="file:///${imgUrl}"></body></html>`;
      fs.writeFileSync(tmpHtmlPath, html, 'utf-8');

      const win = this.createBaseWindow();
      await win.loadFile(tmpHtmlPath);
      await this.injectToDesktop(win);
      await this.fadeWindow(win, 0, 1, 250);

      this.wallpaperWindow = win;
      this.currentWallpaper = wallpaper;
      await this.wallpaperRepo.updateLastUsed(wallpaperId);
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  /**
   * 设置 HTML 壁纸（单文件或目录包），统一注入 WorkerW 背景层（图标下方）
   * loadFile() 加载本地 HTML，相对路径的 js/css 基于文件所在目录自动解析
   */
  async setHTMLWallpaper(wallpaperId: string): Promise<{ success: boolean; error?: string }> {
    const wallpaper = await this.wallpaperRepo.findById(wallpaperId);
    if (!wallpaper) return { success: false, error: '壁纸记录不存在' };
    if (wallpaper.type !== 'html') return { success: false, error: '该壁纸不是 HTML 类型' };

    const htmlPath = wallpaper.filePath;
    if (!fs.existsSync(htmlPath)) return { success: false, error: 'HTML 文件不存在' };

    this.closeCurrentWindow();

    try {
      // 首次设置壁纸时，记录当前系统壁纸路径（用于退出还原）
      if (!this.originalWallpaperPath) {
        const { getWallpaperPath } = await import('../native/workerw');
        this.originalWallpaperPath = getWallpaperPath();
        console.log('[WallpaperManager] Original wallpaper saved:', this.originalWallpaperPath);
      }

      const stat = fs.statSync(htmlPath);
      let indexPath: string;

      if (stat.isDirectory()) {
        // filePath 是目录，定位入口 HTML
        indexPath = path.join(htmlPath, 'index.html');
        if (!fs.existsSync(indexPath)) {
          return { success: false, error: '目录中未找到 index.html' };
        }
      } else {
        indexPath = htmlPath;
      }

      // 统一走 WorkerW 背景层注入（桌面图标下方）
      // loadFile() 加载本地 HTML，相对路径的 js/css 会基于文件所在目录自动解析
      const win = this.createBaseWindow();
      await win.loadFile(indexPath);
      await this.injectToDesktop(win);
      await this.fadeWindow(win, 0, 1, 250);

      this.wallpaperWindow = win;
      this.currentWallpaper = wallpaper;
      await this.wallpaperRepo.updateLastUsed(wallpaperId);
      console.log('[WallpaperManager] HTML wallpaper set (WorkerW background):', indexPath);
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  /**
   * 设置视频壁纸
   * 创建透明窗口播放视频（循环），注入 WorkerW 背景层
   * 仅支持 Chromium 原生播放格式（mp4/webm）
   */
  async setVideoWallpaper(wallpaperId: string): Promise<{ success: boolean; error?: string }> {
    const wallpaper = await this.wallpaperRepo.findById(wallpaperId);
    if (!wallpaper) return { success: false, error: '壁纸记录不存在' };
    if (wallpaper.type !== 'video') return { success: false, error: '该壁纸不是视频类型' };
    if (!fs.existsSync(wallpaper.filePath)) return { success: false, error: '视频文件不存在' };

    // Chromium 仅原生支持 mp4/webm，其他格式无法在壁纸窗口播放
    const ext = path.extname(wallpaper.filePath).toLowerCase();
    if (!['.mp4', '.webm'].includes(ext)) {
      return { success: false, error: `视频格式 ${ext} 不支持桌面播放，请使用 mp4 或 webm 格式` };
    }

    this.closeCurrentWindow();

    try {
      if (!this.originalWallpaperPath) {
        const { getWallpaperPath } = await import('../native/workerw');
        this.originalWallpaperPath = getWallpaperPath();
        console.log('[WallpaperManager] Original wallpaper saved:', this.originalWallpaperPath);
      }

      const videoUrl = wallpaper.filePath.replace(/\\/g, '/');
      const tmpDir = path.join(app.getPath('temp'), 'deskcanvas');
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      const tmpHtmlPath = path.join(tmpDir, 'video-wallpaper.html');
      const html = `<!DOCTYPE html><html><head><style>
        *{margin:0;padding:0}
        html,body{width:100%;height:100%;overflow:hidden;background:#000}
        video{width:100%;height:100%;object-fit:cover;display:block}
      </style></head><body>
        <video src="file:///${videoUrl}" autoplay loop muted playsinline></video>
      </body></html>`;
      fs.writeFileSync(tmpHtmlPath, html, 'utf-8');

      const win = this.createBaseWindow();
      await win.loadFile(tmpHtmlPath);
      await this.injectToDesktop(win);
      await this.fadeWindow(win, 0, 1, 250);

      this.wallpaperWindow = win;
      this.currentWallpaper = wallpaper;
      await this.wallpaperRepo.updateLastUsed(wallpaperId);
      console.log('[WallpaperManager] Video wallpaper set (WorkerW background):', wallpaper.filePath);
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  /** 取消当前壁纸（关闭窗口即可，不影响系统壁纸） */
  async cancelWallpaper(): Promise<void> {
    await this.closeCurrentWindow();
    this.currentWallpaper = null;
    console.log('[WallpaperManager] Wallpaper cancelled');
  }

  /** 获取当前壁纸 */
  getCurrentWallpaper(): Wallpaper | null {
    return this.currentWallpaper;
  }

  /** 获取当前壁纸 ID（用于 Gallery 按钮状态） */
  getCurrentWallpaperId(): string | null {
    return this.currentWallpaper?.id ?? null;
  }

  /** 应用退出时清理：脱离 WorkerW → 关闭窗口 → 还原系统壁纸 */
  async cleanup(): Promise<void> {
    console.log('[WallpaperManager] Cleaning up...');
    await this.closeCurrentWindow();
    this.currentWallpaper = null;

    // 还原系统壁纸（如果有记录）
    if (this.originalWallpaperPath) {
      try {
        const koffi = (await import('koffi')).default;
        const lib = koffi.load('user32.dll');
        const SPI = lib.func(
          'bool SystemParametersInfoW(uint32 uiAction, uint32 uiParam, str pvParam, uint32 fWinIni)'
        );
        SPI(20 /* SPI_SETDESKWALLPAPER */, 0, this.originalWallpaperPath, 1 /* SPIF_UPDATEINIFILE */);
        console.log('[WallpaperManager] Restored system wallpaper:', this.originalWallpaperPath);
      } catch (err) {
        console.error('[WallpaperManager] Failed to restore wallpaper:', err);
      }
    }

    console.log('[WallpaperManager] Cleanup complete');
  }

  // ─── 内部方法 ──

  /** 通过文件头魔数检测图片 MIME 类型（不依赖扩展名） */
  private detectImageMime(buffer: Buffer): string {
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return 'image/png';
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return 'image/jpeg';
    if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) return 'image/webp';
    if (buffer[0] === 0x42 && buffer[1] === 0x4D) return 'image/bmp';
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return 'image/gif';
    return 'image/png'; // 默认
  }

  /** 窗口透明度渐变（fade-in 或 fade-out） */
  private fadeWindow(win: BrowserWindow, from: number, to: number, durationMs = 250): Promise<void> {
    return new Promise((resolve) => {
      const steps = 10;
      const interval = durationMs / steps;
      let step = 0;
      const tick = () => {
        step++;
        const opacity = from + (to - from) * (step / steps);
        win.setOpacity(Math.max(0, Math.min(1, opacity)));
        if (step < steps) {
          setTimeout(tick, interval);
        } else {
          resolve();
        }
      };
      setTimeout(tick, interval);
    });
  }

  /** 创建基础透明窗口 */
  private createBaseWindow(): BrowserWindow {
    const { width, height } = screen.getPrimaryDisplay().size;
    return new BrowserWindow({
      width, height,
      transparent: true,
      frame: false,
      resizable: false,
      skipTaskbar: true,
      alwaysOnTop: false,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });
  }

  /** 设置窗口尺寸并显示（showInactive 不抢夺焦点） */
  private sizeAndShow(win: BrowserWindow): void {
    const { width, height } = screen.getPrimaryDisplay().size;
    win.setSize(width, height);
    win.setPosition(0, 0);
    win.showInactive();
  }

  /** 注入到 WorkerW 背景层 */
  private async injectToDesktop(win: BrowserWindow): Promise<void> {
    const hwnd = win.getNativeWindowHandle();
    const { injectIntoDesktop } = await import('../native/workerw');
    const injected = injectIntoDesktop(hwnd);
    if (!injected) {
      win.close();
      throw new Error('WorkerW 注入失败，当前系统可能不支持此壁纸');
    }
    this.isInjected = true;
    this.sizeAndShow(win);
  }

  /** 关闭当前壁纸窗口（渐隐 → 脱离 WorkerW → 关闭） */
  private async closeCurrentWindow(): Promise<void> {
    if (this.wallpaperWindow) {
      const win = this.wallpaperWindow;
      try {
        // 渐隐效果
        await this.fadeWindow(win, 1, 0, 200);
        // 如果已注入 WorkerW，先脱离再关闭
        if (this.isInjected) {
          const hwnd = win.getNativeWindowHandle();
          const { detachFromDesktop } = await import('../native/workerw');
          detachFromDesktop(hwnd);
          this.isInjected = false;
        }
        win.close();
      } catch { /* ignore */ }
      this.wallpaperWindow = null;
    }
  }

}

// 单例
let instance: WallpaperManager | null = null;

export function getWallpaperManager(): WallpaperManager {
  if (!instance) {
    instance = new WallpaperManager();
  }
  return instance;
}
