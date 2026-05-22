import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { cors } from 'hono/cors'
import { streamSSE } from 'hono/streaming'
import { listGroups, create, rename, getMessages, getMessagesIncremental, getContext } from './session-store.js'
import { piPool } from './pi-pool.js'
import { pipeChatToSSE } from './chat-stream.js'

const app = new Hono()

app.use('/api/*', cors())

// 健康检查
app.get('/api/health', (c) => c.json({ status: 'ok' }))

// ===== 会话管理 =====

// 会话列表
app.get('/api/sessions', (c) => {
  const groups = listGroups()
  return c.json({ groups })
})

// 所有会话运行状态
app.get('/api/sessions/status', (c) => {
  const statuses = piPool.getAllStatus()
  return c.json({ statuses, activeId: piPool.activeId })
})

// 打开/启动会话
app.post('/api/sessions/open', async (c) => {
  const { sessionFile } = await c.req.json()
  if (!sessionFile) return c.json({ error: 'sessionFile required' }, 400)

  try {
    const { messages, status } = await piPool.open(sessionFile)
    piPool.switchTo(sessionFile)
    return c.json({ messages, status })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// 获取会话历史消息（支持增量）
app.get('/api/sessions/messages', (c) => {
  const file = c.req.query('file')
  if (!file) return c.json({ error: 'file query required' }, 400)
  try {
    const sinceStr = c.req.query('since')
    const since = sinceStr ? parseInt(sinceStr, 10) : undefined
    if (since !== undefined && (isNaN(since) || since < 0)) {
      return c.json({ error: 'invalid since value' }, 400)
    }
    const result = getMessagesIncremental(file, since)
    return c.json(result)
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// 切换活跃会话
app.post('/api/sessions/switch', async (c) => {
  const { sessionFile } = await c.req.json()
  if (!sessionFile) return c.json({ error: 'sessionFile required' }, 400)
  piPool.switchTo(sessionFile)
  return c.json({ success: true, activeId: sessionFile })
})

// 关闭会话
app.post('/api/sessions/close', async (c) => {
  const { sessionFile } = await c.req.json()
  if (!sessionFile) return c.json({ error: 'sessionFile required' }, 400)
  await piPool.close(sessionFile)
  return c.json({ success: true })
})

// 删除会话
app.post('/api/sessions/delete', async (c) => {
  const { sessionFile } = await c.req.json()
  if (!sessionFile) return c.json({ error: 'sessionFile required' }, 400)
  await piPool.delete(sessionFile)
  return c.json({ success: true })
})

// 关闭全部
app.post('/api/sessions/close-all', async (c) => {
  await piPool.closeAll()
  return c.json({ success: true })
})

// 重命名会话
app.post('/api/sessions/rename', async (c) => {
  const { sessionFile, name } = await c.req.json()
  if (!sessionFile) return c.json({ error: 'sessionFile required' }, 400)
  if (!name || !name.trim()) return c.json({ error: 'name required' }, 400)

  const success = rename(sessionFile, name.trim())
  if (!success) return c.json({ error: 'Session file not found' }, 404)

  return c.json({ success: true })
})

// 新建会话
app.post('/api/sessions/new', async (c) => {
  try {
    const { cwd } = await c.req.json().catch(() => ({ cwd: undefined }))
    const { relativePath } = create(cwd)

    const { messages, status } = await piPool.open(relativePath)
    piPool.switchTo(relativePath)

    return c.json({ success: true, sessionFile: relativePath, messages, status })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// ===== 模型 & 设置 =====

// 可用模型列表
app.get('/api/models', async (c) => {
  const { execSync } = await import('node:child_process')
  try {
    const output = execSync('pi --list-models 2>&1', { timeout: 10000 }).toString()
    const lines = output.trim().split('\n').slice(1) // 跳过表头
    const models = lines.map(line => {
      const parts = line.trim().split(/\s+/)
      return {
        provider: parts[0] || '',
        modelId: parts[1] || '',
        context: parts[2] || '',
        thinking: parts[4] === 'yes',
      }
    })
    return c.json({ models })
  } catch (err) {
    return c.json({ error: 'Failed to list models' }, 500)
  }
})

// 当前会话状态（含当前模型、思考级别等）
app.get('/api/sessions/state', async (c) => {
  const file = c.req.query('file')
  if (!file) return c.json({ error: 'file query required' }, 400)
  try {
    const state = await piPool.getSessionState(file)
    return c.json(state)
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

// 更新会话设置（模型/思考模式）
app.post('/api/sessions/settings', async (c) => {
  const { sessionFile, modelId, thinkingLevel } = await c.req.json()
  if (!sessionFile) return c.json({ error: 'sessionFile required' }, 400)

  try {
    if (modelId) {
      await piPool.setModel(sessionFile, 'opencode-go', modelId)
    }
    if (thinkingLevel) {
      await piPool.setThinkingLevel(sessionFile, thinkingLevel)
    }
    return c.json({ success: true })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// 会话上下文使用情况
app.get('/api/sessions/context', async (c) => {
  const file = c.req.query('file')
  if (!file) return c.json({ error: 'file query required' }, 400)
  try {
    const ctx = getContext(file)
    return c.json(ctx)
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

// ===== 聊天 =====

// 发消息（给活跃会话），返回 SSE 流
app.post('/api/chat', async (c) => {
  const { message } = await c.req.json()
  if (!message) return c.json({ error: 'message required' }, 400)
  if (!piPool.activeId) {
    return c.json({ error: 'No active session. Open a session first.' }, 400)
  }

  return streamSSE(c, (stream) => pipeChatToSSE(stream, piPool, message))
})

// ===== 全局异常兜底（防止进程意外退出） =====
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err)
})
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason)
})

// ===== 启动 =====

const PORT = parseInt(process.env.PORT || '9099', 10)
serve({ fetch: app.fetch, port: PORT })
console.log(`pi-web server running on http://localhost:${PORT}`)
