/**
 * 鉴权模块
 *
 * - POST /api/auth/login       → 登录，返回 JWT
 * - POST /api/auth/change-password → 改密码
 * - 中间件 protectApi           → 保护所有 /api/*（放行 login 和 health）
 * - 密码用 bcrypt 加盐哈希存储
 */

import { Hono } from 'hono'
import { jwt, sign } from 'hono/jwt'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'
import type { JwtVariables } from 'hono/jwt'

// ===== JWT 密钥（每次启动随机生成，重启后旧 token 失效） =====
export const JWT_SECRET = crypto.randomUUID()

// token 有效期：7 天
const TOKEN_EXP = 7 * 24 * 3600
const SALT_ROUNDS = 10

// ===== 密码配置 =====
const __dirname = dirname(fileURLToPath(import.meta.url))
const CONFIG_PATH = join(__dirname, '..', 'config.json')

interface AppConfig {
  /** bcrypt 哈希后的密码 */
  passwordHash: string
}

function loadConfig(): AppConfig {
  try {
    if (existsSync(CONFIG_PATH)) {
      const raw = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'))
      // 兼容旧版明文密码 → 自动升级为哈希
      if (raw.password && !raw.passwordHash) {
        const hash = bcrypt.hashSync(raw.password, SALT_ROUNDS)
        const config: AppConfig = { passwordHash: hash }
        saveConfig(config)
        return config
      }
      if (raw.passwordHash) return raw
    }
  } catch { /* 使用默认值 */ }
  // 首次启动：生成默认密码哈希
  const hash = bcrypt.hashSync('piweb123', SALT_ROUNDS)
  const config: AppConfig = { passwordHash: hash }
  saveConfig(config)
  return config
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

  const ok = await bcrypt.compare(password, config.passwordHash)
  if (!ok) return c.json({ error: '密码错误' }, 401)

  const token = await sign(
    { sub: 'admin', exp: Math.floor(Date.now() / 1000) + TOKEN_EXP },
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

  const ok = await bcrypt.compare(oldPassword, config.passwordHash)
  if (!ok) return c.json({ error: '旧密码错误' }, 400)

  config.passwordHash = bcrypt.hashSync(newPassword, SALT_ROUNDS)
  saveConfig(config)
  return c.json({ success: true })
})
