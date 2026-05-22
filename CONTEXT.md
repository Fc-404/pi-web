# pi-web — 领域术语表

## 项目定位
独立 Web 服务，用于浏览和与 pi AI coding assistant 的 jsonl 会话文件进行交互。支持多会话独立进程、启动即看历史、删除/关闭会话、标题编辑。

## 术语

### pi
命令行 AI coding assistant（`pi` 命令）。支持 `--mode rpc` 子进程模式，通过 stdin/stdout JSON Lines 通信。

### pi-web（本项目）
运行在浏览器中的聊天界面 + 后端服务。通过 `pi --mode rpc` 子进程与 pi 通信，每个会话可独立启动一个 pi 进程。

### 会话文件（session file）
pi 保存的对话记录。格式为 `.jsonl`（每行一个 JSON 事件），存储在 `~/.pi/agent/sessions/` 目录下。目录结构：顶级目录 = 组（工作目录路径编码），组内文件 = 会话。

### 会话标题
从 jsonl 文件中提取，优先级：
1. **session_info 事件的 name 字段**（用户通过 pi 或 pi-web 修改的名称）
2. **第一条用户消息的文本**
提取时 `session_info.name` 扫描整个文件，用户消息只读前 50 行（性能优化）。

标题可通过前端编辑，后端追加一条 `session_info` 事件到 jsonl 文件末尾。

### 消息类型（HistoryMessage）
前端定义的消息类型，五种角色：

| 角色 | 说明 | 关键字段 |
|:-----|:------|:---------|
| `user` | 用户消息 | `content`、`timestamp` |
| `assistant` | AI 回复 | `content`、`thinking`、`usage`、`model`、`timestamp` |
| `toolCall` | 工具调用 | `toolName`、`toolCallId`、`content`（参数 JSON）、`isError`（中断时） |
| `toolResult` | 工具执行结果 | `toolName`、`toolCallId`、`content`（输出文本）、`isError`、`callArgs`（调用参数，用于摘要） |
| `system` | 系统事件提示 | `content`（如"切换模型: xxx"）、`timestamp` |

#### system 事件来源
从 jsonl 中的非 message 事件解析：
- `model_change` → "切换模型: {provider}/{modelId}"
- `thinking_level_change` → "思考模式: {level}"
- `session_info` → "重命名: {name}"

渲染为分隔线 `─── 提示信息 ───` 样式。

#### toolCall 与 toolResult 的关联
- 后端解析 assistant 消息时，从 `content` 中提取 toolCall 参数缓存（`pendingCallArgs`）
- 解析 toolResult 时按 `toolCallId` 匹配，参数附在 `callArgs` 字段上
- 未匹配的 toolCall（被中断）作为独立 toolCall 消息追加到末尾

### 会话状态
运行时状态，由 PiPool 管理，不依赖外部文件：
- **stopped**：未启动 pi 进程
- **starting**：pi 进程正在启动中（约 6-8 秒）
- **ready**：pi 进程已就绪，可对话

### PiPool（多进程池）
后端核心模块，管理多个独立的 pi RPC 进程。每个打开的会话对应一个独立进程，切换会话无需重启进程。支持打开/关闭/删除会话。

### RpcClient
轻量级 RPC 客户端，通过子进程 `pi --mode rpc` 的 stdin/stdout JSON Lines 管道与 pi 通信。独立实现，不依赖 pi 的 npm 包。

### SSE 事件流
聊天时后端通过 Server-Sent Events 推送 pi RPC 事件，前端实时更新消息：

| 事件类型 | 说明 | 前端处理 |
|:---------|:------|:---------|
| `text_delta` | 文本增量 | 追加到当前 assistant 消息的 content |
| `thinking_delta` | 思考增量 | 追加到当前 assistant 消息的 thinking |
| `tool_execution_start` | 工具调用开始 | 添加一条 toolCall 消息 |
| `tool_execution_end` | 工具调用结束 | 添加一条 toolResult 消息 |
| `agent_end` | 本次生成结束 | 触发 onComplete 回调，刷新完整消息列表 |
| `message_update` | 消息状态快照 | 从中提取 text_delta / thinking_delta |

SSE 正常结束后，自动调用 `fetchSessionMessages` 从后端 jsonl 文件刷新完整消息列表，确保工具调用等内容的完整性和正确顺序。

### 发送/停止机制
- 发送消息时，前端用 `AbortController` 控制 SSE fetch 请求
- AI 回复中 + 输入框为空 → 红色停止按钮
- AI 回复中 + 输入框有文字 → 蓝色发送按钮（**消息队列**：入队不中断当前回复）
- 当前 AI 回复完成后自动发送队列中的下一条消息
- 停止后 `streaming` 状态置为 false，按钮恢复为发送状态

### pi-web 后端
Node.js + TypeScript + Hono 实现的 Web 服务。负责：

| 文件 | 职责 |
|:-----|:------|
| `index.ts` | API 路由 + SSE 流 |
| `pi-pool.ts` | PiPool 多进程池管理 |
| `rpc-client.ts` | pi RPC 子进程通信 |
| `session-store.ts` | 会话文件存储层（合并自 sessions.ts + messages.ts），统一封装会话文件 I/O 和 jsonl 解析 |

### pi-web 前端
React + Vite + TypeScript + Tailwind CSS + shadcn/ui 构建的聊天界面。

**Hooks 层：**

| Hook | 职责 |
|:-----|:------|
| `useSessions` | 会话列表获取、新建、删除 |
| `usePoolStatus` | 轮询进程池状态（每秒） |
| `useChat` | 聊天消息状态、SSE 流式接收、停止生成、消息队列 |
| `useSessionActions` | 会话操作封装（打开/切换/关闭） |
| `useChatContext` | 聊天共享 Context（messages、streaming、thinkingLevel 等） |

**组件层：**

| 组件 | 职责 |
|:-----|:------|
| `Sidebar` | 侧边栏（会话列表、新建、终止、关闭全部），PC 静态 + 移动端 Sheet |
| `ChatHeader` | 标题栏（PC/移动端合一），状态灯、标题编辑、设置按钮、加载进度条 |
| `ChatMessages` | 消息列表 + 悬浮一键到底按钮 + 加载状态 |
| `MessageBubble` | 单条消息气泡（含 system 分隔线、thinking/toolCall/toolResult 折叠） |
| `ChatInput` | 输入框 + 发送/停止按钮 + 全屏编辑 + 上下文进度条 + 思考级别边框色 |
| `FullscreenInput` | 全屏输入界面 |
| `ConfirmDialog` | 删除确认弹窗 |
| `SettingsPanel` | 设置面板（模型/思考模式/折叠默认态/信息栏开关），底部取消/应用 |
| `Toast` | 顶部弹出消息提示（成功/错误/警告/信息），3 秒自动消失 |

**额外 UI：**
- **上下文进度条** — ChatInput 上方 `h-px` 线条，颜色绿→黄→红
- **加载进度条** — ChatHeader 底部 `h-px`，替换 `border-b`，完成后变绿延迟 800ms

### 通信方式
- **API（REST）**：会话列表、打开/关闭/删除/重命名会话、新建会话、获取历史消息
- **SSE（Server-Sent Events）**：聊天消息流式输出，每次发送消息时建立一个 SSE 连接
- **pi RPC 协议**：pi-web 后端通过 RpcClient 启动 `pi --mode rpc` 子进程，通过 stdin/stdout JSON Lines 通信

### 消息展示规则
- **assistant 消息**：始终包裹在气泡中（`bg-zinc-100`）。thinking 用 `<details>` 折叠，正文用 Markdown 渲染
- **toolCall / toolResult**：各自独立气泡，用 `<details>` 折叠，summary 行显示工具名 + 参数摘要
- **全屏预览**：双击消息气泡可全屏查看 Markdown 内容，再双击退出

## 架构关系

### 开发架构
```
┌──────────────────┐   REST + SSE    ┌──────────────────┐
│  浏览器           │◄──────────────►│  pi-web 后端      │
│  React + Tailwind │                 │  Hono + TS        │
└──────────────────┘                 │  PiPool 多进程池   │
                                     │  ┌──────────────┐ │
                                     │  │ pi 进程 (A)  │ │
                                     │  ├──────────────┤ │
                                     │  │ pi 进程 (B)  │ │
                                     │  ├──────────────┤ │
                                     │  │  ...         │ │
                                     │  └──────────────┘ │
                                     └──────────────────┘
```

### 生产部署架构
```
用户 → piweb.xazh.top:80 (nginx auth_basic)
  ├── / → proxy_pass → :8088 → 前端静态文件 (/var/www/piweb/client/)
  └── /api/* → proxy_pass → :8089 → proxy_pass → :3000 (pm2 piweb-server)
```

- 前端：nginx 直接 serve 静态文件（端口 8088）
- 后端：nginx 反向代理（端口 8089）→ pm2 守护的 Node.js（端口 3000）
- 密码验证：nginx auth_basic，文件 `/etc/nginx/.htpasswd-piweb`
- 进程管理：pm2，开机自启
