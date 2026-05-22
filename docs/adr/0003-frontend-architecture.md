# 0003 — 前端架构：Hooks + Context + 组件拆分

## 状态

accepted (updated 2026-05-22: 删除 ChatArea，引入 ChatContext)

## 背景

前端 App.tsx 最初为 699 行单文件，所有逻辑耦合在一起，难以维护和扩展。

## 决策

按"数据层 → 逻辑层 → 展示层"三层拆分，并通过 React Context 减少 props 透传。

### 数据层（Hooks + Context）

| Hook / Context | 职责 | 数据来源 |
|:-----|:------|:---------|
| `useSessions` | 会话列表 CRUD | API `fetchSessions()` |
| `usePoolStatus` | 进程池状态轮询 | API 每秒轮询 |
| `useChat` | 聊天消息 + SSE 流 + 消息队列 | API + SSE |
| `useSessionActions` | 会话操作编排 | 组合多个 API 调用 |
| `ChatContext` / `useChatContext` | 共享聊天状态（messages、streaming、thinkingLevel 等） | useChat + App.tsx |

### 逻辑层（App.tsx）

作为顶层协调器，组合 hooks，管理 UI 状态（侧边栏开关、设置面板、加载进度等）。通过 `ChatContextProvider` 向子组件注入共享状态。

### 展示层（Components）

| 层级 | 组件 |
|:-----|:------|
| 布局 | `Sidebar` |
| 功能 | `ChatHeader`、`ChatMessages`、`ChatInput`、`MessageBubble` |
| 弹窗 | `SettingsPanel`、`ConfirmDialog`、`Toast` |
| 工具 | `FullscreenInput` |
| UI 基础 | shadcn/ui（`button`、`dialog`、`sheet`、`collapsible` 等） |

**架构变化说明：**
- `ChatArea` 已被删除（原是纯透传层，无业务逻辑）
- `ChatHeader` 合并 PC 端和移动端，通过 responsive 类控制显隐
- `SettingsPanel` 内部自管理设置状态（localStorage），不依赖 App.tsx 中转
- 共享聊天状态通过 `ChatContext` 传递，减少 App.tsx → 子组件的 props 透传

## 考虑过的方案

| 被否决方案 | 否决原因 |
|:-----------|:---------|
| Redux / Zustand | 项目规模不需要全局状态管理，props + hooks + Context 足够 |
| 页面路由 | 单页应用，不需要路由 |
| 组件库全量引入 | shadcn/ui 按需引入更轻量 |
| ChatArea 保留 | 纯透传层，无业务价值，删除后架构更扁平 |

## 后果

- 组件职责清晰，新功能容易定位
- hooks + Context 可单独测试
- App.tsx 保持协调器角色，不做 props 中转
- ChatHeader 修改一处同步 PC/移动端
