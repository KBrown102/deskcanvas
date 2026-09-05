# DeskCanvas — 数据模型

> 最后更新：2026-09-05

## 数据库

使用 SQLite（sql.js，纯 WASM 实现，无需原生编译），数据库文件位于 `{userData}/wallpaper.db`。

## 表结构

### wallpapers — 壁纸表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| name | TEXT | NOT NULL | 壁纸名称 |
| type | TEXT | NOT NULL, CHECK IN ('image','html','video') | 壁纸类型 |
| filePath | TEXT | NOT NULL | 壁纸文件路径（绝对路径） |
| thumbnailPath | TEXT | NULLABLE | 缩略图路径 |
| resolution | TEXT | NULLABLE | 分辨率，如 "1920x1080" |
| duration | INTEGER | NULLABLE | 视频壁纸时长（秒） |
| tags | TEXT | DEFAULT '[]' | JSON 数组字符串 |
| isFavorite | INTEGER | DEFAULT 0 | 0=未收藏, 1=已收藏 |
| isAIGenerated | INTEGER | DEFAULT 0 | 0=手动导入, 1=AI 生成 |
| createdAt | TEXT | DEFAULT datetime('now','localtime') | 创建时间 |
| lastUsedAt | TEXT | NULLABLE | 最后使用时间 |

**索引**：
- `idx_wallpapers_type` ON `type`
- `idx_wallpapers_favorite` ON `isFavorite`
- `idx_wallpapers_created` ON `createdAt DESC`

---

### ai_generations — AI 生成记录表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| type | TEXT | NOT NULL, CHECK IN ('image','html') | 生成类型 |
| prompt | TEXT | NOT NULL | 用户输入的提示词 |
| providerId | TEXT | NOT NULL | AI Provider ID |
| model | TEXT | NULLABLE | 使用的模型名称 |
| resultPath | TEXT | NULLABLE | 生成结果文件路径 |
| wallpaperId | TEXT | NULLABLE, FK→wallpapers.id | 关联的壁纸 ID |
| status | TEXT | NOT NULL, DEFAULT 'pending' | pending/success/failed |
| errorMessage | TEXT | NULLABLE | 失败原因 |
| createdAt | TEXT | DEFAULT datetime('now','localtime') | 生成时间 |

**索引**：
- `idx_generations_wallpaper` ON `wallpaperId`
- `idx_generations_status` ON `status`
- `idx_generations_created` ON `createdAt DESC`

---

## TypeScript 类型定义

```typescript
// src/shared/types.ts

type WallpaperType = 'image' | 'html';
type WallpaperStyle = 'fill' | 'fit' | 'stretch' | 'tile' | 'center';
type GenerationStatus = 'pending' | 'success' | 'failed';

interface Wallpaper {
  id: string;
  name: string;
  type: WallpaperType;
  filePath: string;
  thumbnailPath: string | null;
  resolution: string | null;
  tags: string[];
  isFavorite: boolean;
  isAIGenerated: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

interface AIGeneration {
  id: string;
  type: WallpaperType;
  prompt: string;
  providerId: string;
  model: string | null;
  resultPath: string | null;
  wallpaperId: string | null;
  status: GenerationStatus;
  errorMessage: string | null;
  createdAt: string;
}

// AI 生成参数
interface ImageGenParams {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  style?: string;
}

interface HTMLGenParams {
  description: string;
  features?: string[];
  resolution?: { width: number; height: number };
}

// AI Provider 接口
interface IAIProvider {
  readonly id: string;
  readonly name: string;
  readonly capabilities: ('image' | 'html')[];
  generateImage(params: ImageGenParams): Promise<ImageGenResult>;
  generateHTML(params: HTMLGenParams): Promise<HTMLGenResult>;
  checkAvailability(): Promise<ProviderStatus>;
}

interface ImageGenResult {
  success: boolean;
  imagePath?: string;
  error?: string;
}

interface HTMLGenResult {
  success: boolean;
  entryPath?: string;
  fileCount?: number;
  error?: string;
}

type ProviderStatus = 'available' | 'unavailable' | 'unconfigured';

// 应用配置
interface AppConfig {
  wallpaper: {
    defaultStyle: WallpaperStyle;
    transitionEffect: 'none' | 'fade';
    transitionDuration: number;
  };
  ai: {
    activeProvider: string;
    providers: Record<string, ProviderConfig>;
    defaultImageResolution: { width: number; height: number };
  };
  app: {
    language: 'zh-CN' | 'en';
    startMinimized: boolean;
    minimizeToTray: boolean;
    autoStart: boolean;
    theme: 'dark' | 'light' | 'system';
  };
}

interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  enabled: boolean;
}

// 列表筛选
interface ListFilter {
  type?: WallpaperType;
  isFavorite?: boolean;
  isAIGenerated?: boolean;
  keyword?: string;
  sortBy?: 'createdAt' | 'lastUsedAt' | 'name';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}
```

## 数据库初始化 SQL

```sql
CREATE TABLE IF NOT EXISTS wallpapers (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL CHECK(type IN ('image', 'html')),
  filePath      TEXT NOT NULL,
  thumbnailPath TEXT,
  resolution    TEXT,
  tags          TEXT DEFAULT '[]',
  isFavorite    INTEGER DEFAULT 0,
  isAIGenerated INTEGER DEFAULT 0,
  createdAt     TEXT DEFAULT (datetime('now', 'localtime')),
  lastUsedAt    TEXT
);

CREATE TABLE IF NOT EXISTS ai_generations (
  id            TEXT PRIMARY KEY,
  type          TEXT NOT NULL CHECK(type IN ('image', 'html')),
  prompt        TEXT NOT NULL,
  providerId    TEXT NOT NULL,
  model         TEXT,
  resultPath    TEXT,
  wallpaperId   TEXT REFERENCES wallpapers(id),
  status        TEXT NOT NULL DEFAULT 'pending',
  errorMessage  TEXT,
  createdAt     TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_wallpapers_type ON wallpapers(type);
CREATE INDEX IF NOT EXISTS idx_wallpapers_favorite ON wallpapers(isFavorite);
CREATE INDEX IF NOT EXISTS idx_wallpapers_created ON wallpapers(createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_generations_wallpaper ON ai_generations(wallpaperId);
CREATE INDEX IF NOT EXISTS idx_generations_status ON ai_generations(status);
CREATE INDEX IF NOT EXISTS idx_generations_created ON ai_generations(createdAt DESC);
```

## 数据流规则

1. **tags 字段**：以 JSON 数组字符串存储（`'["风景","蓝色"]'`），读取时 `JSON.parse`，写入时 `JSON.stringify`
2. **时间字段**：统一使用 ISO 8601 格式字符串，SQLite 的 `datetime('now','localtime')` 输出格式兼容
3. **路径字段**：存储绝对路径，使用 `path.resolve()` 确保一致性
4. **外键关系**：`ai_generations.wallpaperId` 关联 `wallpapers.id`，删除壁纸时不级联删除生成记录（保留历史）
5. **软删除**：v1 不实现软删除，删除操作直接从数据库移除记录，文件移入回收站
