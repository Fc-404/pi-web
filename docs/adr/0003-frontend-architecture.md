# 0003 — 前端架构：Hooks + 组件拆分

## 状态

accepted

## 背景

前端 App.tsx 最初为 699 行单文件，所有逻辑耦合在一起，难以维护和扩展。

## 决策

按"数据层 → 逻辑层 → 展示层"三层拆分：

### 数据层（Hooks）

| Hook | 职责 | 数据来源 |
|:-----|:------|:---------|
| `useSessions` | 会话列表 CRUD | API `fetchSessions()` |
| `usePoolStatus` | 进程池状态轮询 | API 每秒轮询 |
| `useChat` | 聊天消息 + SSE 流 | API + SSE |
| `useSessionActions` | 会话操作编排 | 组合多个 API 调用 |

### 逻辑层（App.tsx）

作为顶层协调器，组合 hooks，管理 UI 状态（侧边栏开关、删除确认等）。

### 展示层（Components）

| 层级 | 组件 |
|:-----|:------|
| 布局 | `Sidebar`、`ChatArea` |
| 功能 | `ChatHeader`、`ChatMessages`、`ChatInput`、`MessageBubble` |
| 工具 | `FullscreenInput`、`ConfirmDialog` |
| UI 基础 | shadcn/ui（`button`、`dialog`、`sheet`、`collapsible` 等） |

## 考虑过的方案

| 被否决方案 | 否决原因 |
|:-----------|:---------|
| Redux / Zustand | 项目规模不需要全局状态管理，props + hooks 足够 |
| 页面路由 | 单页应用，不需要路由 |
| 组件库全量引入 | shadcn/ui 按需引入更轻量 |

## 后果

- 组件职责清晰，新功能容易定位
- hooks 可单独测试
- App.tsx 保持轻量，只做协调
