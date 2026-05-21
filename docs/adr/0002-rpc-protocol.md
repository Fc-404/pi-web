# 0002 — 与 pi 通信协议：pi --mode rpc 子进程

## 状态

accepted

## 背景

pi-web 需要与 pi AI coding assistant 通信来发送消息和接收回复。有两种方案：通过 pi 的自定义扩展机制（extension），或通过 pi 的 RPC 子进程模式。

## 决策

使用 **`pi --mode rpc` 子进程模式**，而不是自定义扩展。

### 方案对比

| 方案 | 说明 | 否决原因 |
|:-----|:------|:---------|
| pi 自定义扩展 | 在 pi 进程内加载扩展，提供 HTTP/WS API | 扩展与 pi 进程强耦合，版本升级可能 break；需要维护扩展代码 |
| **pi --mode rpc** ✅ | 启动独立子进程，通过 stdin/stdout JSON Lines 通信 | 解耦、稳定、pi 原生支持的协议 |

### 实现方式

- `RpcClient`（`rpc-client.ts`）：管理子进程生命周期，发送命令、接收事件
- `PiPool`（`pi-pool.ts`）：管理多个会话的 RPC 进程池，每个会话一个独立子进程
- 事件通过 SSE 转发到前端

## 后果

- 每个会话需要独立的 pi 进程（约 6-8 秒启动）
- RPC 协议是 JSON Lines，需要自己实现解析（不使用 pi 的 npm 包）
- 子进程退出后需要重新建立连接
