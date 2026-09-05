import * as path from 'path';
import * as fs from 'fs';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { getDataDir } from '../config/data-dir';

/**
 * 壁纸文件管理器
 * 负责壁纸文件的导入、存储、缩略图生成
 */
export class FileManager {
  private wallpapersDir: string;
  private thumbnailsDir: string;
  private htmlDir: string;
  private videoDir: string;

  constructor() {
    const dataDir = getDataDir();
    this.wallpapersDir = path.join(dataDir, 'wallpapers', 'images');
    this.thumbnailsDir = path.join(dataDir, 'thumbnails');
    this.htmlDir = path.join(dataDir, 'wallpapers', 'html');
    this.videoDir = path.join(dataDir, 'wallpapers', 'videos');

    // 确保目录存在
    this.ensureDir(this.wallpapersDir);
    this.ensureDir(this.thumbnailsDir);
    this.ensureDir(this.htmlDir);
    this.ensureDir(this.videoDir);
  }

  /**
   * 确保目录存在
   */
  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * 导入图片壁纸（仅验证格式，返回源路径，不拷贝文件）
   *
   * @param sourcePath 源文件路径
   * @returns 源文件路径（原样返回）
   */
  async importImage(sourcePath: string): Promise<string> {
    const ext = path.extname(sourcePath).toLowerCase();
    if (!['.png', '.jpg', '.jpeg', '.webp', '.bmp'].includes(ext)) {
      throw new Error(`不支持的图片格式: ${ext}`);
    }
    if (!fs.existsSync(sourcePath)) {
      throw new Error('文件不存在');
    }
    return sourcePath;
  }

  /**
   * 导入视频壁纸（仅验证格式，返回源路径，不拷贝文件）
   *
   * @param sourcePath 源文件路径
   * @returns 源文件路径（原样返回）
   */
  async importVideo(sourcePath: string): Promise<string> {
    const ext = path.extname(sourcePath).toLowerCase();
    if (!['.mp4', '.webm', '.avi', '.mov', '.mkv'].includes(ext)) {
      throw new Error(`不支持的视频格式: ${ext}`);
    }
    if (!fs.existsSync(sourcePath)) {
      throw new Error('文件不存在');
    }
    return sourcePath;
  }

  /**
   * 验证目录是否可以作为 HTML 壁纸导入
   * @returns 入口 HTML 文件名，如果无效则抛出错误
   */
  validateHTMLDirectory(sourceDir: string): string {
    if (!fs.existsSync(sourceDir)) {
      throw new Error('目录不存在');
    }
    const stat = fs.statSync(sourceDir);
    if (!stat.isDirectory()) {
      throw new Error('请选择目录而非文件');
    }

    // 查找入口 HTML 文件（优先级：index > main > app > 任意 .html）
    const htmlFiles = ['index.html', 'main.html', 'app.html'];
    for (const name of htmlFiles) {
      if (fs.existsSync(path.join(sourceDir, name))) {
        return name;
      }
    }

    // 查找任意 HTML 文件
    const files = fs.readdirSync(sourceDir);
    const htmlFile = files.find(f => f.endsWith('.html'));
    if (htmlFile) return htmlFile;

    throw new Error('目录中未找到 HTML 文件（需要 index.html、main.html 或任意 .html 文件）');
  }

  /**
   * 导入 HTML 壁纸目录（仅验证目录有效性，返回源目录路径，不拷贝文件）
   *
   * @param sourceDir 源目录路径
   * @returns 源目录路径（原样返回）
   */
  async importHTML(sourceDir: string): Promise<string> {
    // 验证目录有效性（无效则抛出带提示的错误）
    this.validateHTMLDirectory(sourceDir);
    return sourceDir;
  }

  /**
   * 保存 AI 生成的图片（base64 → 文件）
   *
   * @param base64Data base64 编码的图片数据
   * @param format 图片格式（png / jpeg）
   * @returns 保存后的文件路径
   */
  saveAIGeneratedImage(base64Data: string, format: 'png' | 'jpeg' = 'png'): string {
    const ext = format === 'jpeg' ? '.jpg' : '.png';
    const filename = `ai_${uuidv4()}${ext}`;
    const destPath = path.join(this.wallpapersDir, filename);
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(destPath, buffer);
    return destPath;
  }

  /**
   * 保存 AI 生成的 HTML 内容
   *
   * @param htmlContent HTML 字符串
   * @returns 保存后的文件路径
   */
  saveAIGeneratedHTML(htmlContent: string): string {
    const destDir = path.join(this.htmlDir, `ai_${uuidv4()}`);
    this.ensureDir(destDir);
    const destPath = path.join(destDir, 'index.html');
    fs.writeFileSync(destPath, htmlContent, 'utf-8');
    return destPath;
  }

  /**
   * 生成缩略图
   *
   * @param imagePath 图片路径
   * @returns 缩略图路径
   */
  async generateThumbnail(imagePath: string): Promise<string> {
    const thumbFilename = `${path.basename(imagePath, path.extname(imagePath))}_thumb.jpg`;
    const thumbPath = path.join(this.thumbnailsDir, thumbFilename);

    try {
      await sharp(imagePath)
        .resize(320, 180, {
          fit: 'cover',
          position: 'center',
        })
        .jpeg({ quality: 80 })
        .toFile(thumbPath);

      return thumbPath;
    } catch (err) {
      console.error('[FileManager] Failed to generate thumbnail:', err);
      throw new Error('缩略图生成失败');
    }
  }

  /**
   * 生成 HTML 壁纸的缩略图（截图）
   * 注意：这个需要在主进程中通过 BrowserWindow 截图实现
   * 这里返回 null，实际截图由 WallpaperManager 处理
   */
  async generateHTMLThumbnail(htmlPath: string): Promise<string | null> {
    // TODO: 实现 HTML 截图
    // 需要创建一个离屏 BrowserWindow，加载 HTML，然后截图
    return null;
  }

  /**
   * 删除壁纸文件（仅删除工具目录内的文件，即 AI 生成的壁纸）
   * 用户导入的壁纸只存路径引用，不删除源文件
   * @param filePath 壁纸文件或目录路径
   * @param wallpaperId 壁纸 ID（用于清理 HTML 缩略图）
   */
  deleteWallpaper(filePath: string, wallpaperId?: string): void {
    // 安全检查：只删除工具数据目录内的文件（AI 生成的壁纸）
    const dataDir = getDataDir();
    const normalizedPath = path.resolve(filePath);
    const normalizedDataDir = path.resolve(dataDir);
    if (!normalizedPath.startsWith(normalizedDataDir)) {
      // 文件不在工具目录内，是用户导入的源文件，只清理缩略图
      this.cleanupThumbnails(wallpaperId, filePath);
      return;
    }

    if (!fs.existsSync(filePath)) return;

    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      // HTML 目录壁纸：递归删除整个目录
      fs.rmSync(filePath, { recursive: true, force: true });
    } else {
      // 单文件壁纸（图片 / 单 HTML）
      fs.unlinkSync(filePath);
    }

    this.cleanupThumbnails(wallpaperId, filePath);
  }

  /**
   * 清理缩略图文件
   */
  private cleanupThumbnails(wallpaperId?: string, filePath?: string): void {
    // 清理按文件名命名的缩略图（图片壁纸）
    if (filePath) {
      const thumbPath = path.join(
        this.thumbnailsDir,
        `${path.basename(filePath, path.extname(filePath))}_thumb.jpg`
      );
      if (fs.existsSync(thumbPath)) {
        fs.unlinkSync(thumbPath);
      }
    }

    // 清理按 ID 命名的 HTML 缩略图
    if (wallpaperId) {
      const htmlThumbPath = path.join(this.thumbnailsDir, `html_${wallpaperId}_thumb.jpg`);
      if (fs.existsSync(htmlThumbPath)) {
        fs.unlinkSync(htmlThumbPath);
      }
    }
  }

  /**
   * 获取壁纸目录路径
   */
  getWallpapersDir(): string {
    return this.wallpapersDir;
  }

  /**
   * 获取缩略图目录路径
   */
  getThumbnailsDir(): string {
    return this.thumbnailsDir;
  }

  /**
   * 获取视频壁纸目录路径
   */
  getVideoDir(): string {
    return this.videoDir;
  }

  /**
   * 同步复制目录
   */
  private copyDirSync(src: string, dest: string): void {
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        this.ensureDir(destPath);
        this.copyDirSync(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}

// 单例
let instance: FileManager | null = null;

export function getFileManager(): FileManager {
  if (!instance) {
    instance = new FileManager();
  }
  return instance;
}
