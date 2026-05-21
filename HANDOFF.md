# pi-web — 交接文档

## 项目概况

pi-web 是一个独立 Web 服务，用于在浏览器中浏览和与 pi AI coding assistant 的 jsonl 会话文件交互。支持多会话独立 pi 进程、启动即看历史、删除/关闭/编辑会话。

- **项目目录**：`/home/xazh/code/pi-web/`
- **技术栈**：React 19 + shadcn/ui + Tailwind CSS v4 + Hono + TypeScript + pm2
- **启动命令**：`npm run dev`（根目录 monorepo）

## 关键文档（接手 AI 先读这些）

| 文档 | 内容 |
|:-----|:------|
| [`CONTEXT.md`](./CONTEXT.md) | 领域术语表、架构、组件职责、部署架构 |
| [`docs/adr/0001-tech-stack.md`](./docs/adr/0001-tech-stack.md) | 技术栈选型 |
| [`docs/adr/0002-rpc-protocol.md`](./docs/adr/0002-rpc-protocol.md) | pi RPC 通信协议 |
| [`docs/adr/0003-frontend-architecture.md`](./docs/adr/0003-frontend-architecture.md) | 前端 Hooks + 组件拆分 |
| [`docs/adr/0004-deployment.md`](./docs/adr/0004-deployment.md) | 生产部署架构（nginx + pm2） |

## 当前进度

### ✅ 已完成

| 功能 | 说明 |
|:-----|:------|
| 多会话管理 | PiPool 多进程池，每个会话独立 pi 进程 |
| 会话列表 | 按组（工作目录）展示，可折叠，移动端 Sheet |
| 流式聊天 | SSE 流式输出，text_delta / thinking_delta 实时更新 |
| 工具调用实时显示 | 监听 `tool_execution_start/end` 事件，实时显示工具调用和结果 |
| 消息完整刷新 | SSE 结束后自动刷新完整消息列表，解决消息不全问题 |
| 思考折叠 + 工具折叠 | 统一使用 `<details>` 折叠，样式一致 |
| 工具调用参数摘要 | summary 行显示工具名 + 命令/文件路径摘要 |
| 发送/停止按钮 | 发送时变红色停止方块，点击中止 SSE |
| 状态灯呼吸 | AI 生成时标题旁绿点 `animate-pulse` |
| 标题编辑 | 点击铅笔图标编辑，后端追加 `session_info` 事件 |
| 侧边栏优化 | 移动端删除可见、新建/关闭同一排、关闭按钮红色 |
| 全屏预览 | 双击气泡全屏查看 Markdown，再双击退出 |
| 消息横向滚动保护 | 代码块/表格的 scrollLeft 用 ref callback 保持 |
| Git 版本管理 | 已初始化，v0.1.0 tag |
| 生产部署 | nginx + pm2，域名 piweb.xazh.top，auth_basic 密码验证 |
| 文档更新 | CONTEXT.md + 4 篇 ADR 决策记录 |

### 版本规则

- **patch**（第三位）：每次修改/修复
- **minor**（第二位）：实现一个功能时
- **major**（第一位）：大功能发布，由主人告知

## 待办事项

| 优先级 | 事项 | 建议 skill |
|:-------|:-----|:-----------|
| 🟡 中 | **添加测试**（vitest + 后端逻辑测试） | `tdd` |
| 🟡 中 | 新功能：会话搜索、模型切换 | `grill-me` |
| 🟢 低 | 性能优化：pi 启动预加载/缓存 | `diagnose` |
| 🟢 低 | 用 shadcn/ui 组件进一步打磨 UI 一致性 | |

## 已知问题和注意事项

1. **pi 启动慢**：约 6-8 秒才能就绪（`starting` → `ready`），这是 pi 本身的限制
2. **SSE 事件格式**：工具调用是 `tool_execution_start/end` 事件（不是 `role === 'toolCall'`），已在 `useChat.ts` 中处理
3. **SSE 结束后刷新**：`sendMessage` 的 `onComplete` 回调会刷新完整消息列表，可能轻微闪烁，但保证消息完整性
4. **标题修改**：通过追加 `session_info` 事件到 jsonl 文件，不会修改已有的事件
5. **没有测试**：前后端均无自动化测试
6. **IPv6 部署**：域名用 IPv6 DDNS，nginx 需要 `listen [::]:80`
7. **密码文件**：`/etc/nginx/.htpasswd-piweb`，用户 `xazh`
8. **生产目录**：`/var/www/piweb/{client/, server/}`

## 生产环境管理

```bash
# 更新前端
cd /home/xazh/code/pi-web/client && vite build
sudo cp -r dist/* /var/www/piweb/client/

# 更新后端
cd /home/xazh/code/pi-web/server && tsc
sudo cp -r dist/* /var/www/piweb/server/dist/
pm2 restart piweb-server

# 查看后端日志
pm2 logs piweb-server

# 查看 nginx 日志
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## 建议优先使用的 skill

1. **`grill-me`** — 确认新功能需求时先拷问
2. **`tdd`** — 需要写测试时使用
3. **`diagnose`** — 排查复杂 bug
4. **`handoff`** — 再次交接时使用
5. **`improve-codebase-architecture`** — 架构改进时使用
