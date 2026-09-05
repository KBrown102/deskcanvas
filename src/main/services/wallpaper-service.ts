import { WallpaperRepository } from '../database/repositories/wallpaper.repo';
import { getFileManager } from './file-manager';
import { generateHTMLThumbnail } from './html-thumbnail';
import type { Wallpaper } from '../../shared/types';

/**
 * 创建 HTML 壁纸记录并生成缩略图
 * 供导入流程（IPC）和 AI 生成流程共享使用
 *
 * @param filePath HTML 文件或目录路径
 * @param name 壁纸名称
 * @param options 可选参数（标签、是否 AI 生成、分辨率等）
 * @returns 创建的壁纸记录（含 thumbnailPath）
 */
export async function createHTMLWallpaper(
  filePath: string,
  name: string,
  options?: {
    tags?: string[];
    isAIGenerated?: boolean;
    resolution?: string | null;
  }
): Promise<Wallpaper> {
  const wallpaperRepo = new WallpaperRepository();
  const fileManager = getFileManager();

  // 1. 创建壁纸记录（thumbnailPath 先为 null）
  const wallpaper = await wallpaperRepo.create({
    name,
    type: 'html',
    filePath,
    thumbnailPath: null,
    resolution: options?.resolution || null,
    duration: null,
    tags: options?.tags || [],
    isFavorite: false,
    isAIGenerated: options?.isAIGenerated || false,
    lastUsedAt: null,
  });

  // 2. 生成缩略图（离屏渲染 3 秒截图）
  let thumbnailPath: string | null = null;
  try {
    thumbnailPath = await generateHTMLThumbnail(
      filePath, fileManager.getThumbnailsDir(), wallpaper.id
    );
    if (thumbnailPath) {
      await wallpaperRepo.update(wallpaper.id, { thumbnailPath });
    }
  } catch {
    // 缩略图生成失败不影响主流程
  }

  return { ...wallpaper, thumbnailPath };
}
