import { getAllSettings } from './settings-service';
import { getFileManager } from './file-manager';
import { createHTMLWallpaper } from './wallpaper-service';
import { GenerationRepository } from '../database/repositories/generation.repo';
import { WallpaperRepository } from '../database/repositories/wallpaper.repo';
import type { ImageGenParams, HTMLGenParams, AIGeneration } from '../../shared/types';

const API_TIMEOUT = 60000; // 60 秒超时（AGENTS.md 规范）

/**
 * AI 壁纸生成服务
 * 支持图片生成（DALL-E 3）和 HTML 生成（LLM）
 */
export class AIService {
  private genRepo: GenerationRepository;
  private wallpaperRepo: WallpaperRepository;

  constructor() {
    this.genRepo = new GenerationRepository();
    this.wallpaperRepo = new WallpaperRepository();
  }

  // ─── 图片生成（DALL-E 3） ──

  async generateImage(params: ImageGenParams): Promise<AIGeneration> {
    const settings = getAllSettings();
    if (!settings.aiApiKey) throw new Error('请先在设置中配置 API Key');
    if (settings.aiProvider === 'anthropic') {
      throw new Error('图片生成需要 OpenAI 兼容的 /images/generations 接口，Anthropic 不支持。\n请在设置中切换为其他平台（如 Agnes AI、硅基流动 SiliconFlow 等）。');
    }

    const model = settings.aiModel || 'dall-e-3';
    const providerId = settings.aiProvider;

    // 创建生成记录
    const record = await this.genRepo.create({
      type: 'image',
      prompt: params.prompt,
      providerId,
      model,
      resultPath: null,
      wallpaperId: null,
      status: 'pending',
      errorMessage: null,
    });

    try {
      const baseUrl = settings.aiBaseUrl || this.getDefaultBaseURL(providerId);
      const url = `${baseUrl}/images/generations`;

      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(settings),
        body: JSON.stringify({
          model,
          prompt: params.prompt,
          n: 1,
          size: params.width && params.height
            ? `${params.width}x${params.height}`
            : '1024x1024',
        }),
        signal: AbortSignal.timeout(API_TIMEOUT),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API 请求失败 (${response.status}): ${errText.slice(0, 200)}`);
      }

      const data = await response.json();
      const imageData = data.data?.[0];
      if (!imageData) throw new Error('API 返回数据格式异常');

      // 保存图片（兼容 b64_json 和 url 两种返回格式）
      const fileManager = getFileManager();
      let imagePath: string;

      if (imageData.b64_json) {
        // OpenAI 标准格式：base64 编码
        imagePath = fileManager.saveAIGeneratedImage(imageData.b64_json, 'png');
      } else if (imageData.url) {
        // Agnes AI 等Provider：返回图片直链，需下载
        imagePath = await this.downloadImage(imageData.url);
      } else {
        throw new Error('API 返回数据中既无 b64_json 也无 url 字段');
      }

      // 生成缩略图
      let thumbnailPath: string | null = null;
      try {
        thumbnailPath = await fileManager.generateThumbnail(imagePath);
      } catch { /* 缩略图失败不影响主流程 */ }

      // 创建壁纸记录
      const wallpaper = await this.wallpaperRepo.create({
        name: `AI: ${params.prompt.slice(0, 30)}`,
        type: 'image',
        filePath: imagePath,
        thumbnailPath,
        resolution: `${params.width || 1024}x${params.height || 1024}`,
        duration: null,
        tags: ['ai-generated'],
        isFavorite: false,
        isAIGenerated: true,
        lastUsedAt: null,
      });

      // 更新生成记录
      await this.genRepo.updateStatus(record.id, 'success');
      await this.genRepo.linkToWallpaper(record.id, wallpaper.id);

      return { ...record, status: 'success', resultPath: imagePath, wallpaperId: wallpaper.id };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.genRepo.updateStatus(record.id, 'failed', message);
      throw err;
    }
  }

  // ─── HTML 生成（LLM） ──

  async generateHTML(params: HTMLGenParams): Promise<AIGeneration> {
    const settings = getAllSettings();
    // HTML 生成：优先使用专用 API Key，fallback 到主 Key
    const htmlApiKey = settings.aiHtmlApiKey || settings.aiApiKey;
    if (!htmlApiKey) throw new Error('请先在设置中配置 API Key');

    const model = settings.aiHtmlModel || settings.aiModel || this.getDefaultModel(settings.aiProvider);
    const providerId = settings.aiProvider;

    const record = await this.genRepo.create({
      type: 'html',
      prompt: params.description,
      providerId,
      model,
      resultPath: null,
      wallpaperId: null,
      status: 'pending',
      errorMessage: null,
    });

    try {
      const htmlContent = await this.callLLMForHTML(
        { ...settings, aiBaseUrl: settings.aiHtmlBaseUrl || settings.aiBaseUrl, aiApiKey: htmlApiKey },
        model, params
      );

      // 保存 HTML 文件到工具目录
      const fileManager = getFileManager();
      const htmlPath = fileManager.saveAIGeneratedHTML(htmlContent);

      // 通过共享函数创建壁纸记录 + 生成缩略图
      const resolution = `${params.resolution?.width || 1920}x${params.resolution?.height || 1080}`;
      const wallpaper = await createHTMLWallpaper(
        htmlPath,
        `AI: ${params.description.slice(0, 30)}`,
        { tags: ['ai-generated'], isAIGenerated: true, resolution }
      );

      await this.genRepo.updateStatus(record.id, 'success');
      await this.genRepo.linkToWallpaper(record.id, wallpaper.id);

      return { ...record, status: 'success', resultPath: htmlPath, wallpaperId: wallpaper.id };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.genRepo.updateStatus(record.id, 'failed', message);
      throw err;
    }
  }

  // ─── 获取生成历史 ──

  async getHistory(limit: number = 50): Promise<AIGeneration[]> {
    return this.genRepo.findAll(limit);
  }

  // ─── 删除生成历史记录 ──

  async deleteHistory(id: string): Promise<void> {
    await this.genRepo.delete(id);
  }

  // ─── 内部方法 ──

  private getDefaultBaseURL(provider: string): string {
    switch (provider) {
      case 'openai': return 'https://api.openai.com/v1';
      case 'anthropic': return 'https://api.anthropic.com';
      case 'agnes': return 'https://apihub.agnes-ai.com/v1';
      default: return 'https://api.openai.com/v1';
    }
  }

  private getDefaultModel(provider: string): string {
    switch (provider) {
      case 'openai': return 'gpt-4o';
      case 'anthropic': return 'claude-sonnet-4-20250514';
      default: return 'gpt-4o';
    }
  }

  private getHeaders(settings: { aiProvider: string; aiApiKey: string }): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (settings.aiProvider === 'anthropic') {
      headers['x-api-key'] = settings.aiApiKey;
      headers['anthropic-version'] = '2023-06-01';
    } else {
      headers['Authorization'] = `Bearer ${settings.aiApiKey}`;
    }
    return headers;
  }

  /** 调用 LLM 生成 HTML 壁纸代码 */
  private async callLLMForHTML(
    settings: { aiProvider: string; aiApiKey: string; aiBaseUrl: string },
    model: string,
    params: HTMLGenParams
  ): Promise<string> {
    const baseUrl = settings.aiBaseUrl || this.getDefaultBaseURL(settings.aiProvider);
    const isRefine = !!params.existingCode;

    const systemPrompt = isRefine
      ? `You are an expert HTML/CSS/JavaScript developer specializing in creating beautiful desktop wallpaper animations.

You are modifying an EXISTING HTML wallpaper based on the user's refinement instructions.

Rules:
- Output ONLY a complete, self-contained HTML file (no markdown, no explanation)
- The HTML must work standalone with inline CSS and JS
- Use the full viewport (100vw x 100vh)
- Keep the overall style and structure of the original, but apply the requested changes
- Do NOT use external resources (CDN scripts are OK)
- Ensure smooth 60fps animations
- Preserve what works well in the original and only modify what the user asks to change`
      : `You are an expert HTML/CSS/JavaScript developer specializing in creating beautiful desktop wallpaper animations.

Rules:
- Output ONLY a complete, self-contained HTML file (no markdown, no explanation)
- The HTML must work standalone with inline CSS and JS
- Use the full viewport (100vw x 100vh)
- Make it visually stunning with animations, gradients, particles, or other effects
- Do NOT use external resources (CDN scripts are OK)
- Ensure smooth 60fps animations
- The wallpaper should be mesmerizing and suitable for a desktop background`;

    const userPrompt = isRefine
      ? `Here is the current HTML wallpaper code:

\`\`\`html
${params.existingCode}
\`\`\`

Please modify it based on the following instructions:

${params.description}

${params.features?.length ? `Additional features: ${params.features.join(', ')}` : ''}

Output ONLY the complete modified HTML code, nothing else.`
      : `Create an HTML desktop wallpaper based on this description:

${params.description}

${params.features?.length ? `Features to include: ${params.features.join(', ')}` : ''}
${params.resolution ? `Target resolution: ${params.resolution.width}x${params.resolution.height}` : ''}

Output ONLY the complete HTML code, nothing else.`;

    if (settings.aiProvider === 'anthropic') {
      const url = `${baseUrl}/v1/messages`;
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(settings),
        body: JSON.stringify({
          model,
          max_tokens: 8192,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
        signal: AbortSignal.timeout(API_TIMEOUT),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Anthropic API 失败 (${response.status}): ${errText.slice(0, 200)}`);
      }

      const data = await response.json();
      const text = data.content?.[0]?.text;
      if (!text) throw new Error('Anthropic 返回数据格式异常');
      return this.extractHTML(text);
    } else {
      // OpenAI 兼容格式
      const url = `${baseUrl}/chat/completions`;
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(settings),
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 8192,
        }),
        signal: AbortSignal.timeout(API_TIMEOUT),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API 请求失败 (${response.status}): ${errText.slice(0, 200)}`);
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new Error('API 返回数据格式异常');
      return this.extractHTML(text);
    }
  }

  /** 从 URL 下载图片并保存到本地 */
  private async downloadImage(url: string): Promise<string> {
    const response = await fetch(url, { signal: AbortSignal.timeout(API_TIMEOUT) });
    if (!response.ok) throw new Error(`下载图片失败 (${response.status})`);
    const buffer = Buffer.from(await response.arrayBuffer());
    const base64 = buffer.toString('base64');
    const fileManager = getFileManager();
    return fileManager.saveAIGeneratedImage(base64, 'png');
  }

  /** 从 LLM 回复中提取纯 HTML（去除可能的 markdown 代码块包裹） */
  private extractHTML(text: string): string {
    // 去除 ```html ... ``` 包裹
    const match = text.match(/```(?:html)?\s*([\s\S]*?)```/);
    if (match) return match[1].trim();
    // 如果没有代码块包裹，尝试提取 <!DOCTYPE 或 <html 开始的内容
    const htmlStart = text.indexOf('<!DOCTYPE') >= 0 ? text.indexOf('<!DOCTYPE') : text.indexOf('<html');
    if (htmlStart >= 0) return text.slice(htmlStart).trim();
    return text.trim();
  }
}

// 单例
let instance: AIService | null = null;

export function getAIService(): AIService {
  if (!instance) {
    instance = new AIService();
  }
  return instance;
}
