/**
 * 鉴权模块
 *
 * - POST /api/auth/login       → 登录，返回 JWT
 * - POST /api/auth/change-password → 改密码
 * - 中间件 protectApi           → 保护所有 /api/*（放行 login 和 health）
 * - 密码用 SHA-256 哈希存储（前后端一致，前端哈希后传输）
 */

import { Hono } from 'hono'
import { jwt, sign } from 'hono/jwt'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { JwtVariables } from 'hono/jwt'

// ===== JWT 密钥（每次启动随机生成，重启后旧 token 失效） =====
export const JWT_SECRET = crypto.randomUUID()

// token 有效期：7 天
const TOKEN_EXP = 7 * 24 * 3600

// ===== SHA-256 工具 =====
function sha256(hex: string): string {
  // 前端传过来的已经是 SHA-256 十六进制串，直接比较
  return hex
}
// 注意：前端对密码做 SHA-256(password)，后端存储的也是同样的哈希值
// 所以登录/改密码时，前后端传输和存储的都是同样的 SHA-256 哈希

// ===== 密码配置 =====
const __dirname = dirname(fileURLToPath(import.meta.url))
const CONFIG_PATH = join(__dirname, '..', 'config.json')

interface AppConfig {
  /** SHA-256(password) 的十六进制字符串 */
  passwordHash: string
}

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex')
}

function loadConfig(): AppConfig {
  try {
    if (existsSync(CONFIG_PATH)) {
      const raw = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'))
      // 兼容旧版：明文密码 → SHA-256
      if (raw.password && !raw.passwordHash) {
        const hash = hashPassword(raw.password)
        const config: AppConfig = { passwordHash: hash }
        saveConfig(config)
        return config
      }
      // 兼容旧版：bcrypt 哈希 → SHA-256（需要用户重新设置密码）
      // 这里保留 bcrypt 哈希，登录时两种都试
      if (raw.passwordHash) return raw
    }
  } catch { /* 使用默认值 */ }
  const hash = hashPassword('piweb123')
  const config: AppConfig = { passwordHash: hash }
  saveConfig(config)
  return config
}

function saveConfig(config: AppConfig): void {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))
}

const config = loadConfig()

// 判断是否为 bcrypt 哈希（以 $2b$ 或 $2a$ 开头）
const isBcrypt = config.passwordHash.startsWith('$2b$') || config.passwordHash.startsWith('$2a$')

// ===== JWT 中间件（保护 /api/*，放行 login 和 health） =====
export const protectApi = jwt({ secret: JWT_SECRET, alg: 'HS256' })

// ===== Auth 路由 =====
export const authApp = new Hono<{ Variables: JwtVariables }>()

// 登录
authApp.post('/login', async (c) => {
  const { password } = await c.req.json()
  if (!password) return c.json({ error: '请输入密码' }, 400)

  // password 是前端传过来的 SHA-256 哈希串
  if (isBcrypt) {
    // 旧版 bcrypt — 无法兼容前端哈希，报错提示重新设置
    return c.json({ error: '密码格式需要升级，请在服务端重置密码后重启' }, 500)
  }

  if (password !== config.passwordHash) {
    return c.json({ error: '密码错误' }, 401)
  }

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

  if (isBcrypt) {
    return c.json({ error: '密码格式需要升级，请在服务端重置密码后重启' }, 500)
  }

  if (oldPassword !== config.passwordHash) {
    return c.json({ error: '旧密码错误' }, 400)
  }

  config.passwordHash = newPassword
  saveConfig(config)
  return c.json({ success: true })
})
