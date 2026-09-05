import { ipcMain } from 'electron';
import { getAIService } from '../services/ai-service';
import type { ImageGenParams, HTMLGenParams } from '../../shared/types';

/**
 * 注册 AI 生成相关 IPC 处理器
 */
export function registerAIIpc(): void {
  const aiService = getAIService();

  // 生成图片壁纸
  ipcMain.handle('ai:generateImage', async (_event, params: ImageGenParams) => {
    try {
      const result = await aiService.generateImage(params);
      return { success: true, generation: result };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // 生成 HTML 壁纸
  ipcMain.handle('ai:generateHTML', async (_event, params: HTMLGenParams) => {
    try {
      const result = await aiService.generateHTML(params);
      return { success: true, generation: result };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // 获取可用 Provider 列表
  ipcMain.handle('ai:getProviders', () => {
    return [
      { id: 'openai', name: 'OpenAI', models: ['dall-e-3', 'gpt-4o'] },
      { id: 'anthropic', name: 'Anthropic', models: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022'] },
      { id: 'custom', name: '自定义', models: [] },
    ];
  });

  // 获取生成历史
  ipcMain.handle('ai:getHistory', async (_event, limit?: number) => {
    try {
      const history = await aiService.getHistory(limit || 50);
      return history;
    } catch (err) {
      console.error('[IPC] Failed to get AI history:', err);
      return [];
    }
  });

  // 删除生成历史记录
  ipcMain.handle('ai:deleteHistory', async (_event, id: string) => {
    try {
      await aiService.deleteHistory(id);
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
}
