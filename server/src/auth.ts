/**
 * 鉴权模块
 *
 * - POST /api/auth/login       → 登录，返回 JWT
 * - POST /api/auth/change-password → 改密码
 * - 中间件 protectApi           → 保护所有 /api/*（放行 login 和 health）
 */

import { Hono } from 'hono'
import { jwt, sign } from 'hono/jwt'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { JwtVariables } from 'hono/jwt'

// ===== JWT 密钥（每次启动随机生成，重启后旧 token 失效） =====
export const JWT_SECRET = crypto.randomUUID()

// token 有效期：7 天
const TOKEN_EXP = 7 * 24 * 3600

// ===== 密码配置 =====
const __dirname = dirname(fileURLToPath(import.meta.url))
const CONFIG_PATH = join(__dirname, '..', 'config.json')

interface AppConfig {
  password: string
}

function loadConfig(): AppConfig {
  try {
    if (existsSync(CONFIG_PATH)) {
      return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'))
    }
  } catch { /* 使用默认值 */ }
  return { password: 'piweb123' }
}

function saveConfig(config: AppConfig): void {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))
}

const config = loadConfig()

// ===== JWT 中间件（保护 /api/*，放行 login 和 health） =====
export const protectApi = jwt({ secret: JWT_SECRET, alg: 'HS256' })

// ===== Auth 路由 =====
export const authApp = new Hono<{ Variables: JwtVariables }>()

// 登录
authApp.post('/login', async (c) => {
  const { password } = await c.req.json()
  if (!password) return c.json({ error: '请输入密码' }, 400)

  if (password !== config.password) {
    return c.json({ error: '密码错误' }, 401)
  }

  const token = await sign(
    {
      sub: 'admin',
      exp: Math.floor(Date.now() / 1000) + TOKEN_EXP,
    },
    JWT_SECRET,
  )

  return c.json({ token })
})

// 改密码
authApp.post('/change-password', async (c) => {
  const payload = c.get('jwtPayload')
  if (!payload) return c.json({ error: '未授权' }, 401)

  const { oldPassword, newPassword } = await c.req.json()
  if (!oldPassword || !newPassword) return c.json({ error: '请填写完整' }, 400)

  if (oldPassword !== config.password) {
    return c.json({ error: '旧密码错误' }, 400)
  }

  config.password = newPassword
  saveConfig(config)
  return c.json({ success: true })
})
