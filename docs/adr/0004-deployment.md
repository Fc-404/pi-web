# 0004 — 部署架构：nginx + pm2

## 状态

accepted

## 背景

pi-web 上线需要稳定、可维护的生产部署方案。前端是静态文件，后端是 Node.js 服务。

## 决策

采用 **nginx 反向代理 + pm2 进程管理** 的分层架构：

### 架构

```
用户 → piweb.xazh.top:80 (nginx auth_basic)
  ├── / → proxy_pass → :8088 → nginx 前端静态文件 (/var/www/piweb/client/)
  └── /api/* → proxy_pass → :8089 → nginx → proxy_pass → :3000 (pm2 piweb-server)
```

### 各层说明

| 层 | 技术 | 端口 | 说明 |
|:---|:-----|:-----|:------|
| 入口 | nginx | 80 | auth_basic 密码验证，根据路径分发 |
| 前端 | nginx | 8088 | 直接 serve 静态文件，SPA 路由 `try_files` |
| 后端网关 | nginx | 8089 | 代理到 Node.js，配置 SSE 相关参数 |
| 应用 | Node.js + Hono | 3000 | pm2 管理，开机自启 |

### 关键配置

- **密码验证**：nginx `auth_basic` + `auth_basic_user_file`，使用 htpasswd 文件
- **SSE 支持**：`proxy_buffering off; proxy_read_timeout 86400;`
- **进程守护**：pm2 管理，崩溃自动重启
- **目录结构**：`/var/www/piweb/{client/, server/}`

## 考虑过的方案

| 被否决方案 | 否决原因 |
|:-----------|:---------|
| Docker | 单机部署，nginx + pm2 足够简单 |
| 单一端口 | 前后端分离，独立端口更清晰 |
| systemd 直接管理 | pm2 提供日志管理、监控、更易用 |

## 后果

- 更新时需要手动复制文件 + pm2 restart
- 由于使用 IPv6 DDNS，nginx 需要监听 `[::]:80`
- 后续可加 HTTPS（certbot）
