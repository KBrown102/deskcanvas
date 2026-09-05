# DeskCanvas — 开发手册

> 最后更新：2026-09-05
> 本文件是项目最高优先级的开发规范，所有开发行为必须遵守。

## 项目概述

DeskCanvas 是一个基于 Electron 的 Windows 桌面壁纸创作工具，支持图片和 HTML 动态壁纸，集成 AI 生成能力。

**技术栈**：Electron 31+ / React 18 + TypeScript / Ant Design 5 / sql.js + better-sqlite3 / koffi（Win32 FFI）/ Vite

## 开发规则

### 1. 文件与目录规范

- 主进程代码放在 `src/main/`，渲染进程代码放在 `src/renderer/`，共享代码放在 `src/shared/`
- 每个模块一个目录，目录内按职责拆分文件，单文件不超过 300 行
- 组件文件使用 PascalCase 命名（`WallpaperCard.tsx`），工具文件使用 kebab-case（`wallpaper-manager.ts`）
- 类型定义统一放在 `src/shared/types.ts`，常量放在 `src/shared/constants.ts`

### 2. 代码质量

- **TypeScript 严格模式**：`strict: true`，不允许 `any` 类型（特殊情况用 `unknown` + 类型守卫）
- **ESLint + Prettier**：提交前必须通过 lint 检查，无 warning
- **函数长度**：单函数不超过 50 行，超过则拆分
- **注释规则**：公共 API 必须有 JSDoc 注释，复杂逻辑必须有行内注释说明"为什么"而非"是什么"
- **错误处理**：所有异步操作必须有 try-catch，错误必须记录日志并给用户友好提示

### 3. Git 规范

- **分支策略**：`main` 为稳定分支，开发在 `dev` 分支，功能分支命名 `feature/xxx`
- **提交信息格式**：`<type>: <description>`
  - `feat`: 新功能
  - `fix`: 修复 bug
  - `refactor`: 重构（不改变功能）
  - `docs`: 文档更新
  - `style`: 代码格式（不影响逻辑）
  - `chore`: 构建/工具链变更
- **提交粒度**：一个提交只做一件事，不要混合多个功能的修改
- **禁止**：`git push --force` 到 main/dev，`git commit --no-verify`

### 4. 安全规则

- **API Key 绝不硬编码**：所有密钥通过 `electron-store` 存储，不写入代码或 Git
- **contextBridge 最小暴露**：只暴露必要的 IPC 方法，不暴露 `ipcRenderer` 本身
- **HTML 壁纸沙箱**：加载本地 HTML 时禁用 `nodeIntegration`，启用 `contextIsolation`
- **文件路径校验**：所有用户输入的文件路径必须校验，防止路径穿越攻击

### 5. 性能规则

- **缩略图懒加载**：画廊页面使用虚拟滚动或懒加载，不一次性渲染所有缩略图
- **AI 调用超时**：所有 AI API 调用设置 60 秒超时，超时后提示用户重试
- **数据库操作**：批量操作使用事务，避免逐条插入
- **BrowserWindow 复用**：HTML 壁纸切换时复用同一个窗口实例，不反复创建销毁

### 6. 测试规则

- v1 阶段不强制单元测试，但核心模块（WorkerW 注入、壁纸设置）必须有手动验证流程
- 每个功能完成后必须在真实 Windows 环境上验证
- 关键路径（设置壁纸、AI 生成、文件导入）必须有冒烟测试清单

## 开发工作流

### 启动开发

```bash
# 安装依赖
npm install

# 重编译原生模块（首次或依赖更新后，koffi 为预编译无需处理）
npx electron-rebuild -f -w better-sqlite3

# 启动开发模式（主进程 + 渲染进程热更新）
npm run dev
```

### 构建发布

```bash
npm run build
```

## 项目文件结构说明

```
PRODUCT.md          — 产品方向与功能优先级（管方向）
DESIGN.md           — 视觉与交互风格定义（管样子）
AGENTS.md           — 开发行为规则（管规矩）
STATUS.md           — 当前开发进度与待办（管进度）
ARCHITECTURE.md     — 技术架构与模块设计（管结构）
ROUTES.md           — 页面路由与导航结构（管页面）
COMPONENTS.md       — 组件清单与职责说明（管组件）
DATA.md             — 数据模型与数据库设计（管数据）
API.md              — IPC 接口与服务接口（管接口）
TUTORIAL.md         — 用户使用教程（豆包生成 HTML → 导入应用）
```

## 变更规则

- 修改 PRODUCT.md 中的功能优先级需要说明原因
- 修改 DESIGN.md 中的色彩/字体/间距需要全局搜索替换，确保一致性
- 修改 AGENTS.md 中的规则需要团队共识（目前是单人项目，自己决定即可）
- 所有文件修改后更新"最后更新"日期
