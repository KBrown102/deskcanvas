# DeskCanvas — 接口定义

> 最后更新：2026-07-06

## IPC 接口（Renderer ↔ Main）

所有 IPC 通道使用 `invoke/handle` 模式（请求-响应），通过 `contextBridge` 暴露给渲染进程。

### 壁纸操作 `api.wallpaper`

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `setImage` | `(id: string, style?: WallpaperStyle)` | `Promise<{success: boolean, error?: string}>` | 设置图片壁纸 |
| `setHTML` | `(id: string)` | `Promise<{success: boolean, error?: string}>` | 设置 HTML 动态壁纸 |
| `reset` | `()` | `Promise<void>` | 重置为系统默认壁纸 |
| `getCurrent` | `()` | `Promise<Wallpaper \| null>` | 获取当前壁纸信息 |

### 壁纸库管理 `api.library`

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `list` | `(filter?: ListFilter)` | `Promise<Wallpaper[]>` | 获取壁纸列表 |
| `add` | `(filePath: string)` | `Promise<Wallpaper>` | 导入壁纸文件 |
| `remove` | `(id: string)` | `Promise<void>` | 删除壁纸（文件移入回收站） |
| `update` | `(id: string, data: Partial<Wallpaper>)` | `Promise<Wallpaper>` | 更新壁纸信息 |
| `toggleFavorite` | `(id: string)` | `Promise<{isFavorite: boolean}>` | 切换收藏状态 |
| `importHTML` | `(dirPath: string)` | `Promise<Wallpaper>` | 导入 HTML 壁纸目录 |

### AI 生成 `api.ai`

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `generateImage` | `(params: ImageGenParams)` | `Promise<ImageGenResult & {wallpaper?: Wallpaper}>` | AI 生成图片壁纸 |
| `generateHTML` | `(params: HTMLGenParams)` | `Promise<HTMLGenResult & {wallpaper?: Wallpaper}>` | AI 生成 HTML 壁纸 |
| `getProviders` | `()` | `Promise<ProviderInfo[]>` | 获取可用 AI Provider 列表 |
| `getHistory` | `(limit?: number)` | `Promise<AIGeneration[]>` | 获取生成历史记录 |

### 设置 `api.settings`

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `get` | `(key: string)` | `Promise<any>` | 获取单个配置项 |
| `set` | `(key: string, value: any)` | `Promise<void>` | 设置单个配置项 |
| `getAll` | `()` | `Promise<AppConfig>` | 获取所有配置 |

### 系统 `api.system`

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `getScreenInfo` | `()` | `Promise<{width: number, height: number, scale: number}>` | 获取屏幕信息 |
| `selectFile` | `(options?: FileDialogOptions)` | `Promise<string \| null>` | 打开文件选择对话框 |
| `selectDirectory` | `()` | `Promise<string \| null>` | 打开目录选择对话框 |

### HTML 壁纸评测 `api.evaluate`

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `evaluateHTML` | `(wallpaperId: string)` | `Promise<EvaluationResult>` | 对 HTML 壁纸进行健康度评测 |
| `evaluateFile` | `(filePath: string)` | `Promise<EvaluationResult>` | 对指定 HTML 文件进行评测（未导入时） |

**EvaluationResult 类型定义**：

```typescript
interface EvaluationResult {
  score: number;                    // 总分 0-100
  checks: EvaluationCheck[];        // 各项检查结果
  suggestions: string[];            // 修复建议
}

interface EvaluationCheck {
  id: string;                       // 检查项 ID
  name: string;                     // 检查项名称（中文）
  status: 'pass' | 'warning' | 'fail'; // 通过/警告/失败
  message: string;                  // 检查结果说明
  detail?: string;                  // 详细信息（如检测到的外链 URL）
}
```

**评测规则清单**：

| 规则 ID | 名称 | 检查内容 | 失败条件 | 警告条件 |
|---------|------|---------|---------|---------|
| `external-deps` | 外部依赖 | 检测 `<script src>` / `<link href>` 中的外部 URL | 存在 http/https 外链 | 存在相对路径引用 |
| `animation-api` | 动画性能 | 检测是否使用 `requestAnimationFrame` | 使用 `setInterval` 且无 `requestAnimationFrame` | 使用 `setTimeout` 递归 |
| `fullscreen` | 全屏适配 | 检测是否有 `overflow:hidden` 和 viewport 适配 | 有滚动条或固定像素尺寸 | 使用 vh/vw 但未处理 resize |
| `dark-background` | 深色背景 | 检测 body/html 背景色亮度 | 背景色亮度 > 50%（过亮） | 背景色亮度 30%-50% |
| `html-structure` | 代码完整性 | 检测 HTML 基本结构（doctype, html, head, body） | 缺少必要标签 | 缺少 meta viewport |
| `blocking-calls` | 阻塞操作 | 检测 `alert()` / `prompt()` / `confirm()` | 存在阻塞调用 | — |
| `dom-frequency` | DOM 操作频率 | 检测是否在动画循环中频繁操作 DOM | 在 rAF 循环中有 `innerHTML` 赋值 | 在 rAF 循环中有 `style` 修改 |
| `console-logs` | 调试代码 | 检测 `console.log()` 调用 | — | 存在 console 调用（建议清理） |

**评分算法**：
- 每个 `fail` 扣 15 分
- 每个 `warning` 扣 5 分
- `pass` 不扣分
- 最低 0 分，最高 100 分
- 80 分以上：优秀，可直接应用
- 60-79 分：良好，建议修复警告项
- 60 分以下：需要修复后才能获得良好体验

---

## AI Provider 接口

### IAIProvider

所有 AI Provider 必须实现此接口。

```typescript
interface IAIProvider {
  readonly id: string;
  readonly name: string;
  readonly capabilities: ('image' | 'html')[];

  generateImage(params: ImageGenParams): Promise<ImageGenResult>;
  generateHTML(params: HTMLGenParams): Promise<HTMLGenResult>;
  checkAvailability(): Promise<ProviderStatus>;
}
```

### OpenAIProvider

**配置项**：
- `apiKey: string` — OpenAI API Key
- `baseUrl?: string` — 自定义 Base URL（默认 `https://api.openai.com/v1`）
- `imageModel?: string` — 图片生成模型（默认 `dall-e-3`）
- `htmlModel?: string` — HTML 生成模型（默认 `gpt-4o`）

**generateImage 实现**：
1. 调用 `client.images.generate()` 使用 DALL·E 3
2. 下载返回的图片 URL 到本地 `generated/images/` 目录
3. 生成缩略图
4. 返回本地文件路径

**generateHTML 实现**：
1. 构造结构化 Prompt（见设计文档 4.2 节）
2. 调用 `client.chat.completions.create()` 使用 GPT-4o
3. 解析响应中的 HTML 代码（提取 ```html 代码块）
4. 保存到本地 `generated/html/{uuid}/index.html`
5. 返回入口文件路径

### CustomProvider

兼容 OpenAI 格式的第三方 API（如本地 Ollama、第三方中转服务）。

**配置项**：
- `apiKey: string`
- `baseUrl: string` — 必须配置
- `imageModel?: string`
- `htmlModel?: string`

**实现**：与 OpenAIProvider 相同，仅 Base URL 不同。

---

## Repository 接口

### WallpaperRepository

```typescript
interface WallpaperRepository {
  findById(id: string): Promise<Wallpaper | null>;
  findAll(filter?: ListFilter): Promise<Wallpaper[]>;
  create(data: Omit<Wallpaper, 'id' | 'createdAt'>): Promise<Wallpaper>;
  update(id: string, data: Partial<Wallpaper>): Promise<Wallpaper>;
  delete(id: string): Promise<void>;
  toggleFavorite(id: string): Promise<boolean>;
  updateLastUsed(id: string): Promise<void>;
  count(filter?: ListFilter): Promise<number>;
}
```

### GenerationRepository

```typescript
interface GenerationRepository {
  findById(id: string): Promise<AIGeneration | null>;
  findAll(limit?: number): Promise<AIGeneration[]>;
  create(data: Omit<AIGeneration, 'id' | 'createdAt'>): Promise<AIGeneration>;
  updateStatus(id: string, status: GenerationStatus, error?: string): Promise<void>;
  linkToWallpaper(generationId: string, wallpaperId: string): Promise<void>;
}
```

---

## 错误码定义

| 错误码 | 说明 | 用户提示 |
|--------|------|---------|
| `WALLPAPER_NOT_FOUND` | 壁纸记录不存在 | "壁纸不存在，可能已被删除" |
| `WALLPAPER_FILE_MISSING` | 壁纸文件不存在 | "壁纸文件丢失，请重新导入" |
| `SET_WALLPAPER_FAILED` | 设置壁纸失败 | "设置壁纸失败，请重试" |
| `WORKERW_INJECT_FAILED` | WorkerW 注入失败 | "HTML 壁纸嵌入失败，当前系统可能不支持" |
| `AI_PROVIDER_UNAVAILABLE` | AI Provider 不可用 | "AI 服务不可用，请检查 API Key 配置" |
| `AI_GENERATION_FAILED` | AI 生成失败 | "生成失败：{具体原因}" |
| `AI_TIMEOUT` | AI 调用超时 | "生成超时，请重试或检查网络" |
| `FILE_IMPORT_FAILED` | 文件导入失败 | "导入失败：{具体原因}" |
| `DB_ERROR` | 数据库错误 | "数据操作失败，请重启应用" |

---

## 事件通知（Main → Renderer）

主进程通过 `webContents.send` 向渲染进程推送事件：

| 事件 | 数据 | 触发时机 |
|------|------|---------|
| `wallpaper:changed` | `{wallpaper: Wallpaper}` | 壁纸设置成功 |
| `wallpaper:error` | `{error: string}` | 壁纸设置失败 |
| `ai:progress` | `{generationId: string, status: string, progress?: number}` | AI 生成进度更新 |
| `ai:complete` | `{generationId: string, wallpaper?: Wallpaper}` | AI 生成完成 |
| `explorer:restarted` | `null` | 检测到 Explorer 重启，需要重新注入 WorkerW |
