# pi-web — 交接文档

> 生成时间：2026-05-22
> 版本：v1.0.0

## 项目概况

pi-web 是一个独立 Web 服务，用于在浏览器中浏览和与 pi AI coding assistant 的 jsonl 会话文件交互。支持多会话独立 pi 进程、启动即看历史、删除/关闭/编辑会话。

- **项目目录**：`/home/xazh/code/pi-web/`
- **技术栈**：React 19 + shadcn/ui + Tailwind CSS v4 + Hono + TypeScript + pm2
- **开发模式**：`npm run dev`（根目录），后端在 `server/` 下 `PORT=9099 npx tsx src/index.ts`
- **生产环境**：pm2 管理（端口 8088），`/var/www/piweb/server/`
  - 前端：`/var/www/piweb/client/`，nginx 直 serve
  - 后端：`/var/www/piweb/server/dist/index.js`，pm2 守护
  - nginx 配置：`/etc/nginx/sites-available/piweb.xazh.top`
  - pm2：`/home/xazh/.npm-global/bin/pm2`
  - **不要直接动生产环境**，走 dev → main 发布流程

## 分支说明

| 分支 | 用途 | 说明 |
|:-----|:------|:------|
| **main** | 发布版 | 稳定版本，由 dev 合并而来，每次合并打版本 tag |
| **dev** | 开发分支 | 日常开发在此进行，测试无误后合并到 main |
| ~~master~~ | 已删除 | 被 main 替代 |
| ~~test~~ | 已删除 | 被 dev 替代 |

### 版本规则
- **修订号**（第三位）：修复、优化
- **次版本**（第二位）：功能新增
- **主版本**（第一位）：由主人决定
- 版本日志见 [`CHANGELOG.md`](./CHANGELOG.md)

## 当前进度

### ✅ 已完成功能

| 功能 | 说明 |
|:-----|:------|
| 多会话管理 | PiPool 多进程池，每个会话独立 pi 进程 |
| 会话列表 | 按组展示，可折叠，移动端 Sheet |
| 流式聊天 | SSE 流式输出，text_delta / thinking_delta |
| 消息队列（R4） | AI 回复时可发新消息排队，不中断当前回复 |
| 刷新自动加载（R1） | 页面刷新后自动加载活跃会话的历史消息 |
| Toast 消息（R2b） | 顶部弹出，成功/错误/警告/信息，3 秒自动消失 |
| 关闭按钮样式（R2a） | 红色"结束"按钮，已移到侧边栏 |
| 折叠样式统一（R3a） | 手写 `<details>` 替代 base-ui Collapsible（解决溢出） |
| 顶栏设置（R5a） | ⚙️ 按钮打开设置面板 |
| 设置面板（R5b） | 模型选择、思考模式、折叠默认态、信息栏开关 |
| RPC 链路（R5b） | `set_model` / `set_thinking_level` 已打通 |
| 终止按钮移侧边栏（R5c） | 仅活跃会话显示 |
| 折叠默认设置（R6） | localStorage 持久化 |
| 切换加载状态（R7） | 立即清空旧消息 + spinner + 实时进度 |
| 上下文进度条（R8） | ChatInput 上方绿→黄→红 |
| 信息栏（R9） | 气泡外部显示时间、token、花费，可配置 |
| system 事件 | 模型切换/思考模式/重命名显示为分隔线 |
| 工具调用参数合并 | toolCall 参数合并到 toolResult，显示操作摘要 |
| 被中断调用 | 未匹配 toolCall 显示为错误气泡 |
| 思考级别边框色 | 输入框边框颜色随思考级别变化 |
| 紫蓝色主题 | 全部 sky → indigo |
| 全局 outline 禁用 | 所有 input/textarea/select 无聚焦外环 |
| **增量同步** ✅ | IndexedDB 缓存 + 行号 seq + 增量拉取，切换会话秒开 |
| **命令系统** 🆕 | 输入 `/` 弹出命令菜单，`/compress` 压缩上下文 |
| **压缩上下文** 🆕 | 调用 pi RPC 内置 `compact` 命令，AI 总结替换历史 |
| **JWT 鉴权** 🆕 | 登录页 + Token 管理 + 7 天过期 + 密码加盐哈希 |
| **配置页** 🆕 | 侧边栏扳手入口，导航标签，修改密码 |
| **LoadingDots** 🆕 | 三点加载动画替代圆圈 spinner |

### 🏗 架构重构已完成

- ChatArea 删除（原是纯透传层）
- ChatHeader 合并 PC/移动端
- ChatContext 引入，减少 props 透传
- SettingsPanel 自包含状态
- 进度加载逻辑复用（`loadWithProgress`）

## 关键决策记录（ADR）

| 文档 | 内容 |
|:-----|:------|
| [`CONTEXT.md`](./CONTEXT.md) | 领域术语表（已更新增量同步、缓存等术语） |
| [`docs/adr/0001-tech-stack.md`](./docs/adr/0001-tech-stack.md) | 技术栈选型 |
| [`docs/adr/0002-rpc-protocol.md`](./docs/adr/0002-rpc-protocol.md) | pi RPC 通信协议 |
| [`docs/adr/0003-frontend-architecture.md`](./docs/adr/0003-frontend-architecture.md) | 前端架构（已更新） |
| [`docs/adr/0004-deployment.md`](./docs/adr/0004-deployment.md) | 生产部署架构 |

## 待办事项

| 优先级 | 事项 | 建议 skill |
|:-------|:-----|:-----------|
| 🟢 低 | **添加测试**（vitest + 后端逻辑测试） | `tdd` |
| 🟢 低 | **性能优化**：pi 启动预加载/缓存 | `diagnose` |
| 🟢 低 | 用 shadcn/ui 组件进一步打磨 UI 一致性 | |

## 已知问题和注意事项

1. **`asChild` 类型错误** — 已修复（去掉 base-ui Collapsible，改手写）
2. **Collapsible 溢出** — base-ui 的 Panel 组件定位导致宽度不受父容器限制，已全部改为手写 `max-height` 控制
3. **后端 tsx watch** — 使用 `tsx watch` 时 `import.meta.dirname` 为 `undefined`，已改用 `fileURLToPath(import.meta.url)` + `path.dirname`
4. **ScrollArea 白屏** — base-ui 的 ScrollArea 在 flex 容器中 `size-full` 高度计算有问题，已恢复为手写 `overflow-y-auto`
5. **进度条状态更新** — 用 `setTimeout` 而非 `await delay` 避免 setState 合并
6. **端口配置** — 开发版后端 `9099`，生产环境 `8088`
7. **生产目录**：`/var/www/piweb/{client/, server/}`，pm2 管理
8. **nginx 配置**：`/etc/nginx/sites-available/piweb.xazh.top`
9. **密码文件**：`/etc/nginx/.htpasswd-piweb`，用户 `xazh`
10. **应用密码**：`/var/www/piweb/server/config.json`，SHA-256 加盐存储

## 核心文件清单

### 核心文件

| 文件 | 职责 |
|:-----|:------|
| `server/src/index.ts` | API 路由 + SSE 流 |
| `server/src/pi-pool.ts` | 多进程池 |
| `server/src/rpc-client.ts` | pi RPC 子进程通信 |
| `server/src/sessions.ts` | 会话文件 CRUD |
| `server/src/messages.ts` | jsonl 解析（含 system 事件、toolCall 合并） |
| `client/src/App.tsx` | 顶层协调器 |
| `client/src/hooks/useChat.ts` | 聊天状态 + SSE + 消息队列 |
| `client/src/hooks/useChatContext.tsx` | 聊天共享 Context |
| `client/src/hooks/useSessions.ts` | 会话列表 CRUD |
| `client/src/hooks/usePoolStatus.ts` | 进程池状态轮询 |
| `client/src/hooks/useSessionActions.ts` | 会话操作编排 |
| `client/src/lib/db.ts` | IndexedDB 缓存封装（增量同步核心） |
| `client/src/lib/auth.ts` | Token 管理 + 密码 SHA-256 加盐哈希 |

### 组件

| 文件 | 职责 |
|:-----|:------|
| `client/src/components/ChatHeader.tsx` | 标题栏（PC/移动端合一） |
| `client/src/components/ChatMessages.tsx` | 消息列表 + 加载状态 |
| `client/src/components/MessageBubble.tsx` | 消息气泡（含 system/toolCall/toolResult 折叠） |
| `client/src/components/ChatInput.tsx` | 输入框 + 进度条 + 边框色 |
| `client/src/components/Sidebar.tsx` | 侧边栏（PC 静态 + 移动端 Sheet） |
| `client/src/components/SettingsPanel.tsx` | 设置面板 |
| `client/src/components/Toast.tsx` | Toast 消息 |
| `client/src/components/FullscreenInput.tsx` | 全屏输入 |
| `client/src/components/ConfirmDialog.tsx` | 删除确认弹窗 |
| `client/src/components/CommandMenu.tsx` | 命令菜单（/ 触发，键盘导航） |
| `client/src/components/ConfigContent.tsx` | 配置页（导航标签分组） |
| `client/src/components/LoginPage.tsx` | 登录页 |
| `client/src/components/LoadingDots.tsx` | 三点加载动画 |
| `client/src/hooks/useChatActions.ts` | 所有业务逻辑聚合层 |
| `server/src/auth.ts` | JWT 鉴权 + 密码管理 |

## 建议优先使用的 skill

1. **`grill-me`** — 确认新功能需求时先拷问
2. **`tdd`** — 需要写测试时使用
3. **`diagnose`** — 排查复杂 bug
4. **`handoff`** — 再次交接时使用
5. **`improve-codebase-architecture`** — 架构改进时使用
