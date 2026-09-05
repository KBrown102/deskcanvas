import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

/**
 * 数据目录配置
 * - 开发模式（未打包）：项目根目录下的 data/ 文件夹
 * - 生产模式（打包后）：用户目录下的 DeskCanvas/ 文件夹
 * - 用户可在设置中自定义，自定义路径存储在 AppData/settings.json 的 dataDir 字段
 */

const SETTINGS_PATH = path.join(app.getPath('appData'), 'deskcanvas', 'settings.json');

function getDefaultDataDir(): string {
  if (!app.isPackaged) {
    // 开发模式：用项目根目录下的 data/ 文件夹
    const projectRoot = path.resolve(app.getAppPath(), '..', '..');
    return path.join(projectRoot, 'data');
  }
  // 生产模式：用户目录下的 DeskCanvas/
  return path.join(app.getPath('home'), 'DeskCanvas');
}

function readCustomDataDir(): string | null {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const raw = fs.readFileSync(SETTINGS_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed.dataDir && typeof parsed.dataDir === 'string') {
        return parsed.dataDir;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

let cachedDataDir: string | null = null;

export function getDataDir(): string {
  if (cachedDataDir) return cachedDataDir;
  cachedDataDir = readCustomDataDir() || getDefaultDataDir();
  // 确保目录存在
  if (!fs.existsSync(cachedDataDir)) {
    fs.mkdirSync(cachedDataDir, { recursive: true });
  }
  return cachedDataDir;
}

/** 重置缓存（用户修改 dataDir 后调用） */
export function resetDataDirCache(): void {
  cachedDataDir = null;
}
