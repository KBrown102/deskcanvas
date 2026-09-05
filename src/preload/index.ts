import { contextBridge, ipcRenderer } from 'electron';

// 类型定义（与渲染进程共享）
export interface Wallpaper {
  id: string;
  name: string;
  type: 'image' | 'html' | 'video';
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
  type?: 'image' | 'html' | 'video';
  isFavorite?: boolean;
  isAIGenerated?: boolean;
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

// 通过 contextBridge 暴露安全 API 给渲染进程
contextBridge.exposeInMainWorld('api', {
  // 壁纸操作
  wallpaper: {
    setImage: (id: string, style?: string) =>
      ipcRenderer.invoke('wallpaper:setImage', id, style),
    setHTML: (id: string) =>
      ipcRenderer.invoke('wallpaper:setHTML', id),
    setVideo: (id: string) =>
      ipcRenderer.invoke('wallpaper:setVideo', id),
    reset: () =>
      ipcRenderer.invoke('wallpaper:reset'),
    getCurrent: () =>
      ipcRenderer.invoke('wallpaper:getCurrent'),
    getCurrentId: () =>
      ipcRenderer.invoke('wallpaper:getCurrentId'),
    getFileUrl: (id: string) =>
      ipcRenderer.invoke('wallpaper:getFileUrl', id),
    cancel: () =>
      ipcRenderer.invoke('wallpaper:cancel'),
  },

  // 壁纸库管理
  library: {
    list: (filter?: ListFilter) =>
      ipcRenderer.invoke('library:list', filter),
    add: (filePath: string) =>
      ipcRenderer.invoke('library:add', filePath),
    remove: (id: string) =>
      ipcRenderer.invoke('library:remove', id),
    update: (id: string, data: Partial<Wallpaper>) =>
      ipcRenderer.invoke('library:update', id, data),
    toggleFavorite: (id: string) =>
      ipcRenderer.invoke('library:toggleFavorite', id),
    importHTML: (dirPath: string) =>
      ipcRenderer.invoke('library:importHTML', dirPath),
    importVideo: (filePath: string) =>
      ipcRenderer.invoke('library:importVideo', filePath),
  },

  // AI 生成
  ai: {
    generateImage: (params: ImageGenParams) =>
      ipcRenderer.invoke('ai:generateImage', params),
    generateHTML: (params: HTMLGenParams) =>
      ipcRenderer.invoke('ai:generateHTML', params),
    getProviders: () =>
      ipcRenderer.invoke('ai:getProviders'),
    getHistory: (limit?: number) =>
      ipcRenderer.invoke('ai:getHistory', limit),
    deleteHistory: (id: string) =>
      ipcRenderer.invoke('ai:deleteHistory', id),
  },

  // HTML 壁纸评测
  evaluate: {
    evaluateHTML: (wallpaperId: string) =>
      ipcRenderer.invoke('evaluate:html', wallpaperId),
    evaluateFile: (filePath: string) =>
      ipcRenderer.invoke('evaluate:file', filePath),
  },

  // 设置
  settings: {
    get: (key: string) =>
      ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: unknown) =>
      ipcRenderer.invoke('settings:set', key, value),
    getAll: () =>
      ipcRenderer.invoke('settings:getAll'),
    setDataDir: (dataDir: string) =>
      ipcRenderer.invoke('settings:setDataDir', dataDir),
    getDataDir: () =>
      ipcRenderer.invoke('settings:getDataDir'),
  },

  // 系统
  system: {
    getScreenInfo: () =>
      ipcRenderer.invoke('system:screenInfo'),
    selectFile: (options?: Record<string, unknown>) =>
      ipcRenderer.invoke('system:selectFile', options),
    selectDirectory: () =>
      ipcRenderer.invoke('system:selectDirectory'),
    getFileAsDataURL: (filePath: string) =>
      ipcRenderer.invoke('system:getFileAsDataURL', filePath),
    showInFolder: (filePath: string) =>
      ipcRenderer.invoke('system:showInFolder', filePath),
    minimize: () =>
      ipcRenderer.invoke('system:minimize'),
    maximize: () =>
      ipcRenderer.invoke('system:maximize'),
    close: () =>
      ipcRenderer.invoke('system:close'),
    // 关闭弹窗 IPC
    onCloseDialog: (callback: () => void) => {
      ipcRenderer.on('window:show-close-dialog', callback);
    },
    offCloseDialog: (callback: () => void) => {
      ipcRenderer.removeListener('window:show-close-dialog', callback);
    },
    sendCloseResponse: (action: string, remember: boolean) =>
      ipcRenderer.invoke('window:close-response', action, remember),
  },
});
