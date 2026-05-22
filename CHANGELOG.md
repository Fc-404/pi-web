# 版本日志

## v0.2.1 (2026-05-22)

### 🔧 修复优化
- 缓存命中时快速消除加载态（200ms vs 800ms）
- 本地 git hook 保护 main 分支，禁止直接 push

### 📚 文档
- CONTEXT.md 补充分支策略说明

## v0.2.0 (2026-05-22)

### ✨ 功能新增
- **增量同步方案**：IndexedDB 缓存 + 行号 seq + 增量拉取，切换会话秒开
  - 后端新增 `getMessagesIncremental(since?)` 按行号增量读取
  - 前端 IndexedDB 封装 `db.ts`，持久化缓存消息
  - 打开/切换会话时优先走缓存，仅增量拉取新增行
  - SSE 结束后改为增量补全，避免全量刷新
  - reset 机制：文件被重建时自动全量重拉

### 🔧 修复优化
- 修复 Sidebar `<button>` 嵌套 `<button>` 的 HTML 合规警告
- 后端全局异常兜底保护（`uncaughtException` / `unhandledRejection`）
- 缓存写入失败时降级为全量拉取，不影响消息展示
- 清理增量同步调试日志

### 📚 文档
- 更新 CONTEXT.md：新增增量同步、行号 seq、IndexedDB 缓存等术语
- 更新 HANDOFF.md：分支说明、版本规则、增量同步功能清单
- 新增 CHANGELOG.md：版本日志

### 🏗 架构
- 分支策略调整：`main` 为发布版，`dev` 为开发分支
- 远程仓库默认分支改为 `main`

## v0.1.0 (2026-05-20)

### ✨ 功能
- 初始版本发布
- 多会话管理、流式聊天、消息队列
- 设置面板、工具调用展示、system 事件
- 紫蓝色主题、进度条、Toast 通知
- 生产部署：nginx + pm2
