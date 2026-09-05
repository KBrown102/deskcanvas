import { BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import sharp from 'sharp';

/**
 * HTML 壁纸缩略图生成器
 * 使用离屏 BrowserWindow 渲染 HTML，等待 3 秒后截图，保存为缩略图
 */

const THUMB_WIDTH = 320;
const THUMB_HEIGHT = 180;
const RENDER_WAIT_MS = 3000; // 等待 3 秒让 JS 动画/粒子效果渲染

/**
 * 生成 HTML 壁纸缩略图
 * @param htmlPath HTML 文件或目录路径
 * @param thumbnailDir 缩略图保存目录
 * @param wallpaperId 壁纸 ID（用于生成文件名）
 * @returns 缩略图文件路径，失败返回 null
 */
export async function generateHTMLThumbnail(
  htmlPath: string,
  thumbnailDir: string,
  wallpaperId: string
): Promise<string | null> {
  // 确定入口 HTML 文件
  let indexPath: string;
  if (fs.statSync(htmlPath).isDirectory()) {
    indexPath = path.join(htmlPath, 'index.html');
    if (!fs.existsSync(indexPath)) return null;
  } else {
    indexPath = htmlPath;
  }

  // 创建离屏渲染窗口（16:9 比例，与缩略图同比例）
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    show: false,
    webPreferences: {
      offscreen: true,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  try {
    await win.loadFile(indexPath);

    // 等待 JS 动画渲染
    await new Promise(resolve => setTimeout(resolve, RENDER_WAIT_MS));

    // 截图
    const nativeImage = await win.capturePage();
    const pngBuffer = nativeImage.toPNG();

    // 缩放到缩略图尺寸并保存为 JPEG
    const thumbPath = path.join(thumbnailDir, `html_${wallpaperId}_thumb.jpg`);
    await sharp(pngBuffer)
      .resize(THUMB_WIDTH, THUMB_HEIGHT, { fit: 'cover', position: 'center' })
      .jpeg({ quality: 85 })
      .toFile(thumbPath);

    return thumbPath;
  } catch (err) {
    console.error('[HTMLThumbnail] Failed:', err);
    return null;
  } finally {
    win.destroy();
  }
}
