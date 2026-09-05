import { registerWallpaperIpc } from './wallpaper.ipc';
import { registerSettingsIpc, registerWindowIpc } from './settings.ipc';
import { registerAIIpc } from './ai.ipc';

/**
 * 注册所有 IPC 处理器
 */
export function registerAllIpcHandlers(): void {
  registerWallpaperIpc();
  registerSettingsIpc();
  registerWindowIpc();
  registerAIIpc();
  // 后续添加：
  // registerEvaluateIpc();
}
