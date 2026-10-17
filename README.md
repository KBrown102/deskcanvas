# DeskCanvas 🖼️

> AI 桌面壁纸创作工具 —— 用 AI 把想象变成桌面。

DeskCanvas 是一款基于 Electron 的 Windows 桌面壁纸创作工具：通过自然语言描述即可生成壁纸图片或**完整的 HTML 动态壁纸**，也可以把任意本地 HTML/CSS/JS 作品直接设为桌面背景，突破传统图片壁纸的限制。

## ✨ 特性

- **AI 生成壁纸**：接入 OpenAI 兼容 API（支持 DALL·E 3 生图 + LLM 生成 HTML 壁纸），也可对接 Anthropic / 自定义 Base URL
- **HTML 动态壁纸**：基于 WorkerW 注入技术，将完整 HTML 页面渲染为桌面背景（透明、无边框、与桌面图标共存）
- **壁纸库管理**：本地图片 / HTML 目录一键导入，画廊浏览、收藏、搜索、缩略图预览
- **5 种显示风格**：填充 / 适应 / 拉伸 / 平铺 / 居中
- **AI 生成历史**：记录每次生成的提示词、模型与结果，可回溯复用
- **系统托盘**：常驻托盘，快捷显示主窗口 / 退出
- **本地优先**：所有数据存于本地 SQLite，API Key 仅存本机，不上传任何数据

## ⬇️ 下载安装

不想自己构建？直接到 [Releases](https://github.com/KBrown102/deskcanvas/releases) 下载安装包（NSIS 安装版 / 便携版），解压即用。

## 🚀 快速开始

> 环境要求：Windows 10/11，Node.js 18+（Windows 24H2 的 WorkerW 兼容性实机验证进度见 [STATUS.md](STATUS.md)）

```bash
# 1. 安装依赖（postinstall 会自动重编译 better-sqlite3）
npm install

# 2. 启动开发模式（主进程 + 渲染进程热更新）
npm run dev
```

首次使用前，请到「设置」页填写 AI 配置（Provider / API Key / 模型），即可开始生成壁纸。

## 📦 构建打包

```bash
npm run build
```

产出物位于 `release/` 目录：

- `DeskCanvas-<version>-x64.exe` — NSIS 安装版（可选安装目录、创建桌面快捷方式）
- `DeskCanvas-<version>-portable.exe` — 便携版（免安装）

## 🧱 技术栈

| 领域 | 技术 |
|------|------|
| 应用框架 | Electron 31+ |
| UI | React 18 + TypeScript + Ant Design 5 |
| 构建 | Vite 5 |
| 本地存储 | SQLite（sql.js，WASM 实现） |
| Win32 调用 | koffi（FFI，无需 C++ 编译工具链） |
| 打包分发 | electron-builder（NSIS / Portable） |

## 📁 项目结构

```
src/
├── main/          # Electron 主进程
│   ├── database/  #   SQLite 数据访问（Repository 模式）
│   ├── ipc/       #   IPC Handler
│   ├── native/    #   Win32 原生调用（WorkerW 注入等）
│   ├── services/  #   AI / 文件 / 设置 / 托盘等服务
│   └── wallpaper/ #   壁纸引擎（图片 + HTML）
├── preload/       # contextBridge 安全桥接层
├── renderer/      # React 渲染进程（画廊 / 生成 / 收藏 / 历史 / 设置）
└── shared/        # 主进程与渲染进程共享类型
```

## 📚 文档

| 文档 | 内容 |
|------|------|
| [PRODUCT.md](PRODUCT.md) | 产品方向与功能优先级 |
| [DESIGN.md](DESIGN.md) | 视觉与交互风格定义 |
| [ARCHITECTURE.md](ARCHITECTURE.md) | 技术架构与模块设计 |
| [ROUTES.md](ROUTES.md) | 页面路由与导航结构 |
| [COMPONENTS.md](COMPONENTS.md) | 组件清单与职责说明 |
| [DATA.md](DATA.md) | 数据模型与数据库设计 |
| [API.md](API.md) | IPC 接口与服务接口 |
| [TUTORIAL.md](TUTORIAL.md) | 用户使用教程（豆包生成 HTML → 导入应用） |
| [STATUS.md](STATUS.md) | 当前开发进度与待办 |

## 🖼️ 截图

> 待补充（欢迎提交截图 PR）

## 📄 License

[MIT](LICENSE) © DeskCanvas
