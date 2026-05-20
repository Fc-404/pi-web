# 0001 — 技术栈选型：React + Vite + shadcn/ui + Hono

## 状态

accepted

## 背景

pi-web 是一个独立 Web 服务，用于浏览和与 pi AI coding assistant 的 jsonl 会话文件进行交互。需要前后端分离的架构，前端提供现代舒适的聊天界面，后端负责管理 PiPool 多进程池并提供 API。

## 决策

### 前端
| 层面 | 选择 | 原因 |
|:----|:-----|:-----|
| 框架 | **React 19** | 生态最大，社区成熟，长期扩展性好 |
| 构建 | **Vite** | 快速 HMR，TypeScript 原生支持 |
| UI 组件 | **shadcn/ui** + **Tailwind CSS v4** | 组件源码拷贝式集成，按需加载无冗余，样式完全可控 |
| 语言 | **TypeScript** | 后端也是 TS，统一语言栈 |

### 后端
| 层面 | 选择 | 原因 |
|:----|:-----|:-----|
| 运行时 | **Node.js** | pi 本身是 Node.js 生态，调用 pi 进程顺畅 |
| 框架 | **Hono** | 轻量、快速、TypeScript 原生支持，比 Express 更现代 |
| 语言 | **TypeScript** | 类型安全，与前端共享类型定义 |

## 考虑过的方案

| 被否决方案 | 否决原因 |
|:-----------|:---------|
| 纯 CSS + 原生 JS / Alpine.js | 未来项目可能扩大规模，组件化和可维护性不足 |
| Vue + Naive UI | 学习曲线虽低，但 React 生态更庞大，团队/社区资源更丰富 |
| Svelte / SolidJS | 生态较小，第三方库和工具链选择有限 |
| Express | 相比 Hono 较重，TypeScript 支持不如 Hono 原生 |

## 后果

- 前端需要 Vite 构建步骤（不再是纯 HTML 文件）
- 需要前后端联调时配置代理
- shadcn/ui 提供现代化组件（按钮、对话框、输入框等），后续逐步替换手写 UI
