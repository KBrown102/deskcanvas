import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Windows 壁纸样式
 */
export type WallpaperStyle = 'fill' | 'fit' | 'stretch' | 'tile' | 'center';

/**
 * 注册表中的壁纸样式值映射
 */
const STYLE_REGISTRY_MAP: Record<WallpaperStyle, { wallpaperStyle: string; tileWallpaper: string }> = {
  fill:    { wallpaperStyle: '10', tileWallpaper: '0' },
  fit:     { wallpaperStyle: '6',  tileWallpaper: '0' },
  stretch: { wallpaperStyle: '2',  tileWallpaper: '0' },
  tile:    { wallpaperStyle: '0',  tileWallpaper: '1' },
  center:  { wallpaperStyle: '0',  tileWallpaper: '0' },
};

const REGISTRY_PATH = 'HKCU\\Control Panel\\Desktop';

/**
 * 通过注册表设置壁纸显示样式
 */
function setWallpaperStyle(style: WallpaperStyle): void {
  const mapping = STYLE_REGISTRY_MAP[style];
  if (!mapping) return;

  try {
    execSync(
      `reg add "${REGISTRY_PATH}" /v WallpaperStyle /t REG_SZ /d "${mapping.wallpaperStyle}" /f`,
      { stdio: 'pipe' }
    );
    execSync(
      `reg add "${REGISTRY_PATH}" /v TileWallpaper /t REG_SZ /d "${mapping.tileWallpaper}" /f`,
      { stdio: 'pipe' }
    );
  } catch (err) {
    console.error('[Wallpaper] Failed to set wallpaper style:', err);
  }
}

/**
 * 设置图片为桌面壁纸
 *
 * @param imagePath 图片的绝对路径
 * @param style 显示风格（默认 fill）
 * @returns 是否成功
 */
export async function setImageWallpaper(imagePath: string, style: WallpaperStyle = 'fill'): Promise<boolean> {
  try {
    // 1. 确保文件存在
    if (!fs.existsSync(imagePath)) {
      console.error(`[Wallpaper] Image file not found: ${imagePath}`);
      return false;
    }

    // 2. 设置注册表中的壁纸样式
    setWallpaperStyle(style);

    // 3. 使用 wallpaper 包设置壁纸（内部调用 SystemParametersInfoW）
    const wallpaper = await import('wallpaper');
    await wallpaper.setWallpaper(imagePath);

    console.log(`[Wallpaper] Set wallpaper: ${imagePath} (style: ${style})`);
    return true;
  } catch (err) {
    console.error('[Wallpaper] Failed to set wallpaper:', err);
    return false;
  }
}

/**
 * 获取当前壁纸路径（通过注册表读取）
 */
export function getCurrentWallpaperPath(): string | null {
  try {
    const result = execSync(
      `reg query "${REGISTRY_PATH}" /v Wallpaper`,
      { stdio: 'pipe', encoding: 'utf-8' }
    );
    // 解析注册表输出，提取路径
    const match = result.match(/REG_SZ\s+(.+)/);
    if (match) {
      return match[1].trim();
    }
  } catch (err) {
    console.error('[Wallpaper] Failed to get current wallpaper:', err);
  }
  return null;
}
