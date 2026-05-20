# pi-web — 领域术语表

## 项目定位
独立 Web 服务，用于浏览和与 pi AI coding assistant 的 jsonl 会话文件进行交互。支持多会话独立进程、启动即看历史、删除/关闭会话。

## 术语

### pi
命令行 AI coding assistant（`pi` 命令）。支持 `--mode rpc` 子进程模式，通过 stdin/stdout JSON Lines 通信。

### pi-web（本项目）
运行在浏览器中的聊天界面 + 后端服务。通过 `pi --mode rpc` 子进程与 pi 通信，每个会话可独立启动一个 pi 进程。

### 会话文件（session file）
pi 保存的对话记录。格式为 `.jsonl`（每行一个 JSON 事件），存储在 `~/.pi/agent/sessions/` 目录下。目录结构：顶级目录 = 组（工作目录路径编码），组内文件 = 会话。

### 会话状态
运行时状态，由 PiPool 管理，不依赖外部文件：
- **stopped**：未启动 pi 进程
- **starting**：pi 进程正在启动中
- **ready**：pi 进程已就绪，可对话

### PiPool（多进程池）
后端核心模块，管理多个独立的 pi RPC 进程。每个打开的会话对应一个独立进程，切换会话无需重启进程。支持打开/关闭/删除会话。

### RpcClient
轻量级 RPC 客户端，通过子进程 `pi --mode rpc` 的 stdin/stdout JSON Lines 管道与 pi 通信。独立实现，不依赖 pi 的 npm 包。

### pi-web 后端
Node.js + TypeScript + Hono 实现的 Web 服务。负责：提供前端静态文件和 API、管理会话文件、管理 PiPool 多进程池。

### pi-web 前端
React + Vite + TypeScript + Tailwind CSS 构建的聊天界面。提供会话浏览、消息发送、实时对话（SSE 流式输出）等交互。

### 通信方式
- **API（REST）**：会话列表、打开/关闭/删除会话、新建会话、获取历史消息
- **SSE（Server-Sent Events）**：聊天消息流式输出，每次发送消息时建立一个 SSE 连接
- **pi RPC 协议**：pi-web 后端通过 RpcClient 启动 `pi --mode rpc` 子进程，通过 stdin/stdout JSON Lines 通信

### 会话浏览
pi-web 后端直接读取 `~/.pi/agent/sessions/` 文件系统，无需启动 pi 进程。从 jsonl 文件中提取标题（优先取 session_info.name，其次取第一条用户消息）。

## 架构关系

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
