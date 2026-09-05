import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

/**
 * 应用设置服务
 * 使用 JSON 文件持久化，存储在 AppData 固定位置
 * （settings 文件必须在 dataDir 确定之前就可读，所以放在固定位置）
 */

interface AppSettings {
  // AI Provider 配置
  aiProvider: 'openai' | 'anthropic' | 'custom';
  aiApiKey: string;
  aiBaseUrl: string;
  aiModel: string;
  // HTML 生成专用模型（走 /chat/completions，与生图模型分开）
  aiHtmlModel: string;
  aiHtmlBaseUrl: string;
  aiHtmlApiKey: string;
  // 应用偏好
  autoStart: boolean;
  language: 'zh' | 'en';
  // 数据存储位置（留空则使用默认路径）
  dataDir: string;
  // 关闭窗口行为：ask=每次询问、tray=最小化到托盘、quit=直接退出
  closeBehavior: 'ask' | 'tray' | 'quit';
}

const DEFAULT_SETTINGS: AppSettings = {
  aiProvider: 'openai',
  aiApiKey: '',
  aiBaseUrl: '',
  aiModel: '',
  aiHtmlModel: '',
  aiHtmlBaseUrl: '',
  aiHtmlApiKey: '',
  autoStart: false,
  language: 'zh',
  dataDir: '',
  closeBehavior: 'ask',
};

const SETTINGS_FILE = 'settings.json';

function getSettingsPath(): string {
  return path.join(app.getPath('appData'), 'deskcanvas', SETTINGS_FILE);
}

function readSettings(): AppSettings {
  try {
    const filePath = getSettingsPath();
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (err) {
    console.error('[Settings] Failed to read settings:', err);
  }
  return { ...DEFAULT_SETTINGS };
}

function writeSettings(settings: AppSettings): void {
  try {
    const filePath = getSettingsPath();
    fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Settings] Failed to write settings:', err);
  }
}

let cachedSettings: AppSettings | null = null;

function getSettings(): AppSettings {
  if (!cachedSettings) {
    cachedSettings = readSettings();
  }
  return cachedSettings;
}

export function getSetting(key: keyof AppSettings): unknown {
  return getSettings()[key];
}

export function setSetting(key: keyof AppSettings, value: unknown): void {
  const settings = getSettings();
  (settings as any)[key] = value;
  cachedSettings = settings;
  writeSettings(settings);
  console.log(`[Settings] Updated: ${key} = ${typeof value === 'string' && value.length > 20 ? value.slice(0, 20) + '...' : value}`);
}

export function getAllSettings(): AppSettings {
  return getSettings();
}

export type { AppSettings };
