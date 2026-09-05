// 共享类型定义，供主进程和渲染进程使用

export type WallpaperType = 'image' | 'html' | 'video';

export interface Wallpaper {
  id: string;
  name: string;
  type: WallpaperType;
  filePath: string;
  thumbnailPath: string | null;
  resolution: string | null;
  duration: number | null;
  tags: string[];
  isFavorite: boolean;
  isAIGenerated: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface ListFilter {
  type?: WallpaperType;
  isFavorite?: boolean;
  isAIGenerated?: boolean;
  tag?: string;
  keyword?: string;
  sortBy?: 'createdAt' | 'lastUsedAt' | 'name';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface ImageGenParams {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  style?: string;
}

export interface HTMLGenParams {
  description: string;
  features?: string[];
  resolution?: { width: number; height: number };
  /** 优化模式：传入原始 HTML 代码，AI 基于此代码进行修改 */
  existingCode?: string;
}

export interface ImageGenResult {
  success: boolean;
  imagePath?: string;
  error?: string;
}

export interface HTMLGenResult {
  success: boolean;
  entryPath?: string;
  fileCount?: number;
  error?: string;
}

export interface EvaluationCheck {
  id: string;
  name: string;
  status: 'pass' | 'warning' | 'fail';
  message: string;
  detail?: string;
}

export interface EvaluationResult {
  score: number;
  checks: EvaluationCheck[];
  suggestions: string[];
}

export interface ScreenInfo {
  width: number;
  height: number;
  scale: number;
}

export type WallpaperStyle = 'fill' | 'fit' | 'stretch' | 'tile' | 'center';

export type GenerationStatus = 'pending' | 'success' | 'failed';

export interface AIGeneration {
  id: string;
  type: 'image' | 'html';
  prompt: string;
  providerId: string;
  model: string | null;
  resultPath: string | null;
  wallpaperId: string | null;
  status: GenerationStatus;
  errorMessage: string | null;
  createdAt: string;
}
