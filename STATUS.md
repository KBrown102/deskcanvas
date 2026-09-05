# DeskCanvas — 开发进度

> 最后更新：2026-09-05

## 当前阶段：v0.1.0 功能完成，进入打磨与发布

## 已完成

### 第一阶段：基础框架 + 图片壁纸 ✅

- [x] 产品方向确认（创作者工具向）
- [x] 视觉风格确认（玻璃拟态）
- [x] 技术设计文档完成
- [x] 项目手册文件创建（PRODUCT/DESIGN/AGENTS + 进阶文件）
- [x] 项目脚手架搭建（Electron + React + TypeScript + Vite）
- [x] Electron 主进程入口 + 窗口创建
- [x] React 渲染进程入口 + 路由配置（画廊 / 生成 / 收藏 / 历史 / 设置 / 详情）
- [x] contextBridge IPC 桥接层（安全暴露，不泄露 ipcRenderer）
- [x] Win32 FFI 绑定（koffi，无需 C++ 编译工具链）
- [x] 图片壁纸设置功能（SystemParametersInfoW + 5 种显示风格）
- [x] SQLite 数据库初始化 + Repository 层（sql.js WASM 实现）
- [x] 壁纸库 CRUD 功能
- [x] 画廊 / 详情 / 收藏 / 历史 / 设置页面 UI
- [x] 文件导入功能（图片 + HTML 目录）
- [x] 缩略图生成（HTML 截图 + 视频抽帧）

### 第二阶段：HTML 动态壁纸 ✅

- [x] WorkerW 查找与注入逻辑（koffi 动态加载 user32.dll）
- [x] HTML 壁纸 BrowserWindow 管理（透明无边框）
- [x] 心跳检测与 Explorer 重启恢复
- [x] 壁纸预览弹窗
- [x] 收藏功能

### 第三阶段：AI 生成 ✅

- [x] AI Provider 接口定义 + 注册表
- [x] OpenAI 兼容 Provider 实现（DALL-E 3 图片生成 + LLM HTML 生成）
- [x] AI 生成页面 UI（图片 / HTML 双模式）
- [x] 生成历史记录（ai_generations 表）
- [x] 设置页面（AI 配置：Provider / API Key / 模型 / Base URL）

### 第四阶段：打磨与发布（部分完成）

- [x] 系统托盘（显示窗口 / 退出菜单）
- [x] electron-builder 打包配置（NSIS 安装版 + 便携版均已产出）
- [ ] 开机自启（autoStart 配置已就绪，系统登录项同步待完善）
- [ ] HTML 壁纸健康度评测（preload 接口已定义，IPC 注册未接入）
- [ ] 视频壁纸设置（数据模型已支持 video 类型，设置引擎待接入）
- [ ] 内置默认壁纸
- [ ] 错误处理完善（用户可见错误提示统一化）

## 待办（后续版本）

- [ ] 壁纸切换过渡动效
- [ ] 内置 HTML 壁纸模板库（粒子、时钟、天气等）
- [ ] AI Provider 多后端增强（本地 SD、自定义 API）
- [ ] 壁纸社区（上传/下载/评分）
- [ ] 插件系统（第三方壁纸类型扩展）
- [ ] 多显示器独立壁纸
- [ ] 壁纸轮播 / 定时切换
- [ ] 视频壁纸支持（MP4/WebM）

## 风险与阻塞

| 风险 | 状态 | 备注 |
|------|------|------|
| ~~node-ffi-napi 编译问题~~ | 已解决 | 已改用 koffi（预编译 FFI），不再需要 C++ 编译工具链 |
| Windows 24H2 WorkerW 兼容性 | 待验证 | 需在 24H2 实机验证 |
| AI API 调用成本 | 关注中 | 开发阶段使用免费额度 |
| sql.js 大数据量性能 | 关注中 | 壁纸数量较大时考虑迁移 better-sqlite3 |
