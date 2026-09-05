# DeskCanvas — 组件清单

> 最后更新：2026-07-06

## 布局组件

### Layout/Sidebar

侧边栏导航组件。

**Props**：
- `currentRoute: string` — 当前路由路径
- `onNavigate: (route: string) => void` — 导航回调

**状态**：无内部状态

**依赖**：react-router-dom, lucide-react 图标

---

### Layout/TitleBar

自定义标题栏组件（Electron 无边框窗口）。

**Props**：
- `title: string` — 窗口标题
- `onMinimize: () => void` — 最小化
- `onMaximize: () => void` — 最大化/还原
- `onClose: () => void` — 关闭

**状态**：`isMaximized: boolean`

**注意**：最大化/还原需要监听窗口状态变化

---

### Layout/AppLayout

整体布局容器，组合 Sidebar + TitleBar + 内容区。

**Props**：
- `children: ReactNode` — 页面内容

**状态**：无

---

## 壁纸相关组件

### WallpaperCard

壁纸缩略图卡片，用于画廊/收藏页面的网格展示。

**Props**：
- `wallpaper: Wallpaper` — 壁纸数据
- `onPreview: (id: string) => void` — 预览回调
- `onApply: (id: string) => void` — 应用为壁纸回调
- `onToggleFavorite: (id: string) => void` — 收藏回调

**状态**：`isHovered: boolean`

**交互**：
- hover 显示操作按钮（应用/收藏/更多）
- 点击打开预览
- 双击直接应用

---

### WallpaperPreview

壁纸预览弹窗，展示大图/HTML 预览。

**Props**：
- `wallpaper: Wallpaper` — 壁纸数据
- `visible: boolean` — 是否显示
- `onClose: () => void` — 关闭回调
- `onApply: (id: string, style?: string) => void` — 应用回调

**状态**：`selectedStyle: WallpaperStyle`

**注意**：HTML 壁纸预览使用 iframe 加载本地文件

---

### CurrentWallpaper

左下角当前壁纸指示器。

**Props**：
- `wallpaper: Wallpaper | null` — 当前壁纸数据
- `onChange: () => void` — 点击切换回调

**状态**：无

---

## AI 生成组件

### PromptInput

AI 提示词输入组件。

**Props**：
- `value: string` — 输入值
- `onChange: (value: string) => void` — 变化回调
- `placeholder?: string` — 占位符
- `maxLength?: number` — 最大长度（默认 500）

**状态**：内部字符计数

**特性**：
- 多行文本框
- 右下角显示字符计数
- 支持 Ctrl+Enter 快捷提交

---

### GenerationModeSwitch

生成模式切换（图片/HTML）。

**Props**：
- `mode: 'image' | 'html'` — 当前模式
- `onChange: (mode: 'image' | 'html') => void` — 切换回调

**状态**：无

---

### GenerationProgress

AI 生成进度显示组件。

**Props**：
- `status: 'pending' | 'generating' | 'success' | 'failed'` — 生成状态
- `progress?: number` — 进度百分比（0-100）
- `message?: string` — 状态消息
- `onCancel?: () => void` — 取消回调

**状态**：无

---

### GenerationHistory

生成历史记录列表。

**Props**：
- `records: GenerationRecord[]` — 历史记录
- `onApply: (id: string) => void` — 重新应用回调
- `onDelete: (id: string) => void` — 删除回调

**状态**：无

---

## HTML 评测组件

### EvaluationPanel

HTML 壁纸健康度评测面板，展示评测结果和修复建议。

**Props**：
- `result: EvaluationResult | null` — 评测结果
- `loading: boolean` — 是否正在评测
- `onReEvaluate: () => void` — 重新评测回调
- `onFix: (checkId: string) => void` — 一键修复回调（可选）

**状态**：`expandedChecks: Set<string>` — 展开的检查项

**布局**：
- 顶部：总分环形进度条（0-100）+ 评级文字（优秀/良好/需修复）
- 中部：检查项列表，每项显示图标（✓//✗）、名称、说明
- 底部：修复建议列表 + 重新评测按钮

**交互**：
- 点击检查项可展开查看详情
- 失败项用红色高亮，警告项用黄色，通过项用绿色
- 加载时显示骨架屏

---

### ScoreRing

环形分数展示组件，用于评测面板顶部。

**Props**：
- `score: number` — 分数（0-100）
- `size?: number` — 尺寸（默认 120px）
- `label?: string` — 中心文字（默认显示分数）

**样式**：
- 80 分以上：绿色渐变环
- 60-79 分：黄色渐变环
- 60 分以下：红色渐变环

---

### CheckItem

单项检查结果展示组件。

**Props**：
- `check: EvaluationCheck` — 检查结果数据
- `expanded: boolean` — 是否展开详情
- `onToggle: () => void` — 展开/收起回调

**样式**：
- 通过：绿色对勾图标 + 淡绿色左边框
- 警告：黄色三角图标 + 淡黄色左边框
- 失败：红色叉号图标 + 淡红色左边框

---

## 通用组件

### GlassCard

毛玻璃卡片容器，所有页面内容的基础容器。

**Props**：
- `children: ReactNode`
- `className?: string`
- `hoverable?: boolean` — 是否启用 hover 效果
- `onClick?: () => void`

**样式**：遵循 DESIGN.md 的毛玻璃效果定义

---

### ActionButton

带图标的操作按钮。

**Props**：
- `icon: ReactNode` — 图标
- `label: string` — 按钮文字
- `variant: 'primary' | 'secondary' | 'danger' | 'ghost'` — 样式变体
- `loading?: boolean` — 加载状态
- `disabled?: boolean` — 禁用状态
- `onClick?: () => void` — 点击回调

---

### Tag

标签组件，用于壁纸标签展示。

**Props**：
- `label: string` — 标签文字
- `color?: string` — 自定义颜色
- `removable?: boolean` — 是否可删除
- `onRemove?: () => void` — 删除回调

---

### EmptyState

空状态展示组件。

**Props**：
- `icon: ReactNode` — 图标
- `title: string` — 标题
- `description?: string` — 描述
- `action?: ReactNode` — 操作按钮

---

## 组件开发规则

1. 所有组件必须有 TypeScript 类型定义（Props 接口）
2. 组件文件使用 PascalCase 命名
3. 单个组件文件不超过 150 行，超过则拆分子组件
4. 样式使用 CSS Modules 或 Tailwind（本项目推荐 CSS Modules + 全局变量）
5. 组件不直接调用 IPC，通过 props 或 hooks 获取数据
6. 所有用户交互必须有视觉反馈（loading/hover/active 状态）
