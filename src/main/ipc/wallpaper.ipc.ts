import { ipcMain, dialog, shell } from 'electron';
import { getWallpaperManager } from '../wallpaper/wallpaper-manager';
import { getFileManager } from '../services/file-manager';
import { generateVideoThumbnail, getVideoInfo, isVideoFile } from '../services/video-thumbnail';
import { createHTMLWallpaper } from '../services/wallpaper-service';
import { WallpaperRepository } from '../database/repositories/wallpaper.repo';
import type { Wallpaper, ListFilter, WallpaperStyle } from '../../shared/types';
import * as path from 'path';
import * as fs from 'fs';

/**
 * 注册壁纸相关 IPC 处理器
 */
export function registerWallpaperIpc(): void {
  const wallpaperManager = getWallpaperManager();
  const wallpaperRepo = new WallpaperRepository();
  const fileManager = getFileManager();

  // 设置图片壁纸
  ipcMain.handle('wallpaper:setImage', async (_event, id: string, style?: WallpaperStyle) => {
    try {
      return await wallpaperManager.setImageWallpaper(id, style || 'fill');
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  // 设置 HTML 壁纸
  ipcMain.handle('wallpaper:setHTML', async (_event, id: string) => {
    try {
      return await wallpaperManager.setHTMLWallpaper(id);
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  // 设置视频壁纸
  ipcMain.handle('wallpaper:setVideo', async (_event, id: string) => {
    try {
      return await wallpaperManager.setVideoWallpaper(id);
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  // 重置壁纸
  ipcMain.handle('wallpaper:reset', async () => {
    try {
      await wallpaperManager.cancelWallpaper();
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  // 获取当前壁纸
  ipcMain.handle('wallpaper:getCurrent', async () => {
    return wallpaperManager.getCurrentWallpaper();
  });

  // 获取当前壁纸 ID（用于按钮状态）
  ipcMain.handle('wallpaper:getCurrentId', async () => {
    return wallpaperManager.getCurrentWallpaperId();
  });

  // 获取壁纸文件的 file:// URL（用于 <video> 等标签直接加载本地大文件）
  ipcMain.handle('wallpaper:getFileUrl', async (_event, id: string) => {
    try {
      const wallpaper = await wallpaperRepo.findById(id);
      if (!wallpaper) return null;
      const filePath = wallpaper.filePath.replace(/\\/g, '/');
      return `file:///${filePath}`;
    } catch {
      return null;
    }
  });

  // 取消当前壁纸
  ipcMain.handle('wallpaper:cancel', async () => {
    try {
      await wallpaperManager.cancelWallpaper();
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  // 获取壁纸列表
  ipcMain.handle('library:list', async (_event, filter?: ListFilter) => {
    try {
      return await wallpaperRepo.findAll(filter);
    } catch (err) {
      console.error('[IPC] Failed to list wallpapers:', err);
      return [];
    }
  });

  // 导入壁纸文件（图片 / 单 HTML）
  ipcMain.handle('library:add', async (_event, filePath: string) => {
    try {
      const ext = path.extname(filePath).toLowerCase();
      const isImage = ['.png', '.jpg', '.jpeg', '.webp', '.bmp'].includes(ext);
      const isHtml = ext === '.html' || ext === '.htm';

      if (!isImage && !isHtml) {
        return { success: false, error: '不支持的文件格式' };
      }

      // 标准化路径用于去重检测
      const normalizedPath = path.resolve(filePath);

      // 重复导入检测
      const existing = await wallpaperRepo.findByFilePath(normalizedPath);
      if (existing) {
        return { success: false, error: '该壁纸已在画廊中，无需重复导入' };
      }

      if (isHtml) {
        // HTML 文件：通过共享函数创建（自动建库 + 生成缩略图）
        const name = path.basename(filePath, ext);
        const wallpaper = await createHTMLWallpaper(normalizedPath, name);
        return { success: true, wallpaper };
      }

      // 图片：验证格式 + 获取源路径（不拷贝）
      await fileManager.importImage(filePath);

      // 标准化路径（确保与去重查询一致）
      const sourcePath = path.resolve(filePath);

      // 生成缩略图
      let thumbnailPath: string | null = null;
      try {
        thumbnailPath = await fileManager.generateThumbnail(sourcePath);
      } catch {
        // 缩略图生成失败不影响导入
      }

      // 获取图片分辨率
      let resolution: string | null = null;
      try {
        const metadata = await require('sharp')(sourcePath).metadata();
        if (metadata.width && metadata.height) {
          resolution = `${metadata.width}x${metadata.height}`;
        }
      } catch {
        // 忽略
      }

      const wallpaper = await wallpaperRepo.create({
        name: path.basename(filePath, ext),
        type: 'image',
        filePath: sourcePath,
        thumbnailPath,
        resolution,
        duration: null,
        tags: [],
        isFavorite: false,
        isAIGenerated: false,
        lastUsedAt: null,
      });

      return { success: true, wallpaper };
    } catch (err) {
      console.error('[IPC] Failed to import wallpaper:', err);
      return { success: false, error: String(err) };
    }
  });

  // 删除壁纸
  ipcMain.handle('library:remove', async (_event, id: string) => {
    try {
      const wallpaper = await wallpaperRepo.findById(id);
      if (wallpaper) {
        fileManager.deleteWallpaper(wallpaper.filePath, wallpaper.id);
      }
      await wallpaperRepo.delete(id);
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  // 更新壁纸信息
  ipcMain.handle('library:update', async (_event, id: string, data: Partial<Wallpaper>) => {
    try {
      const updated = await wallpaperRepo.update(id, data);
      return updated;
    } catch (err) {
      return null;
    }
  });

  // 切换收藏
  ipcMain.handle('library:toggleFavorite', async (_event, id: string) => {
    try {
      const isFavorite = await wallpaperRepo.toggleFavorite(id);
      return { isFavorite };
    } catch (err) {
      return { isFavorite: false };
    }
  });

  // 导入 HTML 目录
  ipcMain.handle('library:importHTML', async (_event, dirPath: string) => {
    try {
      // 验证目录有效性（无 HTML 文件会抛出带提示的错误）
      const sourceDir = await fileManager.importHTML(dirPath);

      // 标准化路径用于去重检测
      const normalizedPath = path.resolve(sourceDir);

      // 重复导入检测
      const existing = await wallpaperRepo.findByFilePath(normalizedPath);
      if (existing) {
        return { success: false, error: '该壁纸已在画廊中，无需重复导入' };
      }

      // 通过共享函数创建（自动建库 + 生成缩略图）
      const name = path.basename(dirPath);
      const wallpaper = await createHTMLWallpaper(normalizedPath, name);

      return { success: true, wallpaper };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // 导入视频壁纸
  ipcMain.handle('library:importVideo', async (_event, filePath: string) => {
    try {
      if (!isVideoFile(filePath)) {
        return { success: false, error: '不支持的视频格式' };
      }

      // 标准化路径用于去重检测
      const normalizedPath = path.resolve(filePath);

      // 重复导入检测
      const existing = await wallpaperRepo.findByFilePath(normalizedPath);
      if (existing) {
        return { success: false, error: '该壁纸已在画廊中，无需重复导入' };
      }

      // 验证格式（不拷贝）
      await fileManager.importVideo(filePath);

      // 标准化路径（确保与去重查询一致）
      const sourcePath = normalizedPath;
      const ext = path.extname(filePath).toLowerCase();

      // 获取视频信息（时长 + 分辨率）
      let resolution: string | null = null;
      let duration: number | null = null;
      try {
        const info = await getVideoInfo(sourcePath);
        if (info) {
          resolution = info.width && info.height ? `${info.width}x${info.height}` : null;
          duration = info.duration || null;
        }
      } catch {
        // 获取失败不影响导入
      }

      const wallpaper = await wallpaperRepo.create({
        name: path.basename(filePath, ext),
        type: 'video',
        filePath: sourcePath,
        thumbnailPath: null,
        resolution,
        duration,
        tags: [],
        isFavorite: false,
        isAIGenerated: false,
        lastUsedAt: null,
      });

      // 生成视频缩略图（ffmpeg 截帧）
      let thumbnailPath: string | null = null;
      try {
        thumbnailPath = await generateVideoThumbnail(
          sourcePath, fileManager.getThumbnailsDir(), wallpaper.id
        );
        if (thumbnailPath) {
          await wallpaperRepo.update(wallpaper.id, { thumbnailPath });
        }
      } catch {
        // 缩略图生成失败不影响导入
      }

      return { success: true, wallpaper: { ...wallpaper, thumbnailPath } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // 打开文件选择对话框
  ipcMain.handle('system:selectFile', async (_event, options?: { filters?: { name: string; extensions: string[] }[] }) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: options?.filters || [
        { name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  // 打开目录选择对话框
  ipcMain.handle('system:selectDirectory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  // 打开文件所在目录
  ipcMain.handle('system:showInFolder', async (_event, filePath: string) => {
    try {
      shell.showItemInFolder(filePath);
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  // 获取屏幕信息
  ipcMain.handle('system:screenInfo', async () => {
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;
    const scale = primaryDisplay.scaleFactor;
    return { width, height, scale };
  });

  // 将本地文件读取为 base64 data URL（用于缩略图显示等场景）
  ipcMain.handle('system:getFileAsDataURL', async (_event, filePath: string) => {
    try {
      if (!fs.existsSync(filePath)) return null;
      const data = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase().slice(1);
      const mimeMap: Record<string, string> = {
        jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
        webp: 'image/webp', bmp: 'image/bmp', gif: 'image/gif',
        html: 'text/html', htm: 'text/html',
      };
      const mime = mimeMap[ext] || 'application/octet-stream';
      return `data:${mime};base64,${data.toString('base64')}`;
    } catch {
      return null;
    }
  });
}
