# DeskCanvas — 技术架构

> 最后更新：2026-09-05

## 整体架构

```
┌──────────────────────────────────────────────────────────────┐
│                    Electron Renderer Process                  │
│  ┌──────────┐  ──────────┐  ┌──────────┐  ┌──────────────┐ │
│  │ 壁纸画廊  │  │ AI 生成  │  │ 我的壁纸  │  │   设置页面   │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬───────┘ │
│       ──────────────┴─────────────────────────────┘         │
│                         IPC (contextBridge)                    │
├──────────────────────────────────────────────────────────────┤
│                     Electron Main Process                     │
│  ─────────────────────────────────────────────────────────┐ │
│  │                    IPC Handler Layer                     │ │
│  └────┬──────────────┬──────────────┬──────────────┬───────┘ │
│       │              │              │              │           │
│  ┌────▼────┐   ┌─────▼─────┐  ┌────▼────┐  ┌─────▼─────┐   │
│  │Wallpaper│   │    AI     │  │  File   │  │  Settings │   │
│  │ Engine  │   │  Service  │  │ Manager │  │  Manager  │   │
│  └────┬────┘   └─────┬─────┘  └────┬────┘  └───────────┘   │
│       │              │              │                         │
│  ┌────▼──────────────▼──────────────▼──────────────────┐    │
│  │              Native Bridge (Win32 FFI)               │    │
│  │  SystemParametersInfoW · FindWindow · SetParent · …  │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │              SQLite (wallpaper.db)                    │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

## 进程职责

### 主进程（Main Process）

负责所有系统级操作：

- **Wallpaper Engine**：图片壁纸（SystemParametersInfoW）和 HTML 壁纸（WorkerW 注入）
- **Native Bridge**：通过 koffi 调用 Win32 API（无需 C++ 编译工具链）
- **AI Service**：管理 AI Provider，调用外部 API
- **File Manager**：文件存储、缩略图生成、目录管理
- **Database**：SQLite 数据持久化
- **Settings**：应用配置管理

### 渲染进程（Renderer Process）

只负责 UI 展示和用户交互：

- 通过 contextBridge 暴露的受限 API 与主进程通信
- 无法直接访问文件系统或系统 API
- 所有数据通过 IPC 获取和提交

### 预加载脚本（Preload）

- 使用 contextBridge 安全桥接
- 只暴露必要的 IPC 方法，不暴露 ipcRenderer 本身
- 定义 TypeScript 类型确保调用安全

## 核心模块

### Wallpaper Engine

```
WallpaperManager (总控)
├── ImageWallpaper (图片壁纸)
│   └── SystemParametersInfoW + 注册表样式控制
└── HTMLWallpaper (HTML 动态壁纸)
    ├── WorkerW 查找与注入
    ├── BrowserWindow 管理（透明无边框）
    └── 心跳检测与恢复机制
```

### AI Service

```
AIProviderRegistry (注册表)
├── IAIProvider (接口)
│   ├── generateImage()
│   ├── generateHTML()
│   └── checkAvailability()
├── OpenAIProvider (DALL·E + GPT-4o)
├── LocalSDProvider (预留)
└── CustomProvider (OpenAI 兼容 API)
```

### File Manager

```
FileManager
├── 壁纸存储（images/、html/、generated/）
├── 缩略图生成（sharp + capturePage）
├── 文件导入（图片 + HTML 目录）
└── 路径管理与校验
```

## 数据流

### 设置图片壁纸

```
用户点击"设为壁纸"
  → Renderer 调用 api.wallpaper.setImage(id, style)
    → IPC Handler 接收
      → WallpaperManager 查询数据库获取文件路径
        → ImageWallpaper 调用 SystemParametersInfoW
          → 更新数据库 lastUsedAt
            → 返回成功状态
              → Renderer 更新 UI
```

### 设置 HTML 壁纸

```
用户点击"设为壁纸"
  → Renderer 调用 api.wallpaper.setHTML(id)
    → IPC Handler 接收
      → HTMLWallpaper 创建/复用 BrowserWindow
        → 加载 HTML 入口文件
          → WorkerW 注入（SetParent）
            → 更新数据库状态
              → 返回成功状态
                → Renderer 更新 UI
```

### AI 生成图片

```
用户输入描述并点击生成
  → Renderer 调用 api.ai.generateImage(params)
    → IPC Handler 接收
      → AIProviderRegistry 获取当前 Provider
        → OpenAIProvider 调用 DALL·E API
          → 下载图片到本地
            → FileManager 生成缩略图
              → Database 写入壁纸记录 + 生成记录
                → 返回结果（图片路径 + 缩略图）
                  → Renderer 跳转到画廊展示
```

## 技术依赖

| 依赖 | 用途 | 版本要求 |
|------|------|---------|
| electron | 应用框架 | ^31.0.0 |
| react + react-dom | UI 框架 | ^18.3.0 |
| typescript | 类型系统 | ^5.5.0 |
| vite | 构建工具 | ^5.4.0 |
| antd | UI 组件库 | ^5.20.0 |
| zustand | 状态管理 | ^4.5.0 |
| better-sqlite3 | 本地数据库（保留依赖，当前未使用） | ^11.0.0 |
| koffi | Win32 API 调用（FFI） | ^3.1.0 |
| sharp | 图片处理 | ^0.33.0 |
| sql.js | 数据库（WASM 实现） | ^1.14.0 |
| electron-builder | 打包分发 | ^25.0.0 |
