/**
 * SessionStore — 会话文件存储层
 *
 * 统一封装所有会话 jsonl 文件的读写操作。
 * 职责：文件 I/O + jsonl 解析，不涉及进程管理。
 *
 * 合并自 sessions.ts 和 messages.ts，提供更集中的接口。
 */

import { readdirSync, readFileSync, existsSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { randomUUID } from 'node:crypto'

import type {
  Usage,
  HistoryMessage,
  SessionInfo,
  SessionGroup,
  SessionContext,
} from '@pi-web/shared'

export type {
  Usage,
  HistoryMessage,
  SessionInfo,
  SessionGroup,
  SessionContext,
}

// =====================================================================
// 常量
// =====================================================================

const SESSION_DIR = join(homedir(), '.pi', 'agent', 'sessions')

// =====================================================================
// 内部工具
// =====================================================================

/** 将会话文件相对/绝对路径解析为绝对路径 */
function resolvePath(sessionFile: string): string {
  return sessionFile.startsWith('/') ? sessionFile : join(SESSION_DIR, sessionFile)
}

/** 工作目录路径编码为组目录名 */
function encodeGroupName(workDir: string): string {
  return '--' + workDir.replace(/^\//, '').replace(/\//g, '-') + '--'
}

/** 从组名尝试还原工作目录 */
function groupDirToCwd(dir: string): string {
  const inner = dir.replace(/^--/, '').replace(/--$/, '')
  return '/' + inner.replace(/-/g, '/')
}

// =====================================================================
// 内部：jsonl 解析工具
// =====================================================================

/** 从 jsonl 首行读取 session 基本信息 */
function readSessionHeader(filePath: string): { id: string; timestamp: string; cwd: string } | null {
  try {
    const firstLine = readFileSync(filePath, 'utf-8').split('\n')[0]
    if (!firstLine) return null
    const data = JSON.parse(firstLine)
    if (data.type === 'session') {
      return { id: data.id, timestamp: data.timestamp, cwd: data.cwd }
    }
    return null
  } catch {
    return null
  }
}

/**
 * 从 jsonl 文件中提取会话标题
 * 优先级：
 *   1. session_info 行的 name 字段（扫描整个文件）
 *   2. 第一条用户消息的文本（只读前 50 行，性能优化）
 */
function extractSessionTitle(filePath: string): string {
  try {
    const content = readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')
    const headerLimit = 50
    const maxLines = Math.min(lines.length, headerLimit)

    let sessionInfoName: string | null = null
    let firstUserText = ''

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      try {
        const entry = JSON.parse(line)

        if (entry.type === 'session_info' && entry.name) {
          sessionInfoName = entry.name.trim()
        }

        if (i < maxLines && !firstUserText && entry.type === 'message' && entry.message?.role === 'user' && entry.message?.content) {
          const contentArr = Array.isArray(entry.message.content) ? entry.message.content : [entry.message.content]
          for (const part of contentArr) {
            if (part.type === 'text' && part.text) {
              firstUserText = part.text.trim()
              break
            }
          }
        }
      } catch { /* 跳过格式异常的行 */ }
    }

    return sessionInfoName || firstUserText
  } catch {
    return ''
  }
}

/** 判断 jsonl 是否仅有 session header（无任何消息事件） */
function isEmptySessionFile(filePath: string): boolean {
  try {
    const content = readFileSync(filePath, 'utf-8')
    const lines = content.trim().split('\n').filter(l => l.trim())
    return lines.length <= 1
  } catch {
    return true
  }
}

// =====================================================================
// 公开 API
// =====================================================================

// ---- 会话列表 ----

/** 获取所有会话组和会话列表 */
export function listGroups(): SessionGroup[] {
  const groups: SessionGroup[] = []

  const entries = readdirSync(SESSION_DIR, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const dir = entry.name
    const groupPath = join(SESSION_DIR, dir)

    const files = readdirSync(groupPath)
    const jsonlFiles = files.filter(f => f.endsWith('.jsonl') && !f.startsWith('.'))

    const sessions: SessionInfo[] = []
    let groupCwd: string | null = null

    for (const file of jsonlFiles) {
      const filePath = join(groupPath, file)
      const id = file.match(/_(.+?)\.jsonl$/)?.[1] || file.replace(/\.jsonl$/, '')
      const header = readSessionHeader(filePath)
      if (header?.cwd) groupCwd = header.cwd
      const title = extractSessionTitle(filePath)
      const empty = isEmptySessionFile(filePath)

      sessions.push({
        id,
        file: `${dir}/${file}`,
        startedAt: header?.timestamp || file.split('_')[0] || '',
        title,
        isEmpty: empty,
      })
    }

    sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    const cwd = groupCwd || groupDirToCwd(dir)
    groups.push({ dir, cwd, sessions })
  }

  groups.sort((a, b) => a.dir.localeCompare(b.dir))
  return groups
}

/** 获取最新的会话文件（按 startedAt） */
export function findLatest(): string | null {
  const groups = listGroups()
  let latest: { file: string; startedAt: string } | null = null
  for (const group of groups) {
    for (const session of group.sessions) {
      if (!latest || session.startedAt > latest.startedAt) {
        latest = { file: session.file, startedAt: session.startedAt }
      }
    }
  }
  return latest?.file || null
}

// ---- 会话 CRUD ----

/** 创建新的会话 jsonl 文件 */
export function create(cwd?: string): { relativePath: string; fullPath: string } {
  const workDir = cwd || homedir()
  const groupName = encodeGroupName(workDir)
  const sessionId = randomUUID()
  const timestamp = new Date().toISOString()
  const fileName = timestamp.replace(/:/g, '-') + '_' + sessionId + '.jsonl'
  const relativePath = groupName + '/' + fileName
  const fullPath = join(SESSION_DIR, groupName, fileName)

  mkdirSync(dirname(fullPath), { recursive: true })
  writeFileSync(fullPath, JSON.stringify({
    type: 'session', version: 3, id: sessionId, timestamp, cwd: workDir,
  }) + '\n')

  return { relativePath, fullPath }
}

/** 删除会话文件（jsonl + meta） */
export function remove(sessionFile: string): void {
  const fullPath = resolvePath(sessionFile)
  if (existsSync(fullPath)) unlinkSync(fullPath)
  const metaPath = fullPath.replace(/\.jsonl$/, '.meta.json')
  if (existsSync(metaPath)) unlinkSync(metaPath)
}

/** 更新会话标题（追加 session_info 事件到 jsonl 末尾） */
export function rename(sessionFile: string, newName: string): boolean {
  const fullPath = resolvePath(sessionFile)
  if (!existsSync(fullPath)) return false

  writeFileSync(fullPath, JSON.stringify({
    type: 'session_info',
    id: randomUUID(),
    parentId: null,
    timestamp: new Date().toISOString(),
    name: newName,
  }) + '\n', { flag: 'a' })

  return true
}

// ---- 消息读取 ----

/**
 * 从 jsonl 会话文件中读取历史消息
 *
 * 解析规则参见 CONTEXT.md "消息类型（HistoryMessage）" 章节。
 */
export function getMessages(sessionFile: string): HistoryMessage[] {
  const fullPath = resolvePath(sessionFile)
  const content = readFileSync(fullPath, 'utf-8')
  const lines = content.split('\n').filter(l => l.trim())

  const messages: HistoryMessage[] = []
  const pendingCallArgs = new Map<string, { args: string; toolName: string }>()

  for (const line of lines) {
    try {
      const data = JSON.parse(line)
      const type = data.type

      // 非 message 事件 → system 提示
      if (type === 'model_change') {
        messages.push({ role: 'system', content: `切换模型: ${data.provider}/${data.modelId}`, timestamp: new Date(data.timestamp).getTime() })
        continue
      }
      if (type === 'thinking_level_change') {
        messages.push({ role: 'system', content: `思考模式: ${data.thinkingLevel}`, timestamp: new Date(data.timestamp).getTime() })
        continue
      }
      if (type === 'session_info') {
        messages.push({ role: 'system', content: `重命名: ${data.name}`, timestamp: new Date(data.timestamp).getTime() })
        continue
      }
      if (type === 'context_compress') {
        messages.push({ role: 'system', content: data.summary, timestamp: new Date(data.timestamp).getTime() })
        continue
      }
      if (type !== 'message') continue

      const msg = data.message
      const role = msg.role

      if (role === 'user' || role === 'assistant') {
        let text = ''
        let thinking = ''

        for (const c of msg.content || []) {
          if (c.type === 'text') text += c.text || ''
          else if (c.type === 'thinking') thinking += c.thinking || ''
          else if (c.type === 'toolCall') {
            const argsStr = typeof c.arguments === 'string' ? c.arguments : JSON.stringify(c.arguments || '')
            const toolCallId = c.id || ''
            const toolName = c.name || 'unknown'
            if (toolCallId) pendingCallArgs.set(toolCallId, { args: argsStr, toolName })
          }
        }

        if (!text && !thinking) continue

        const base: HistoryMessage = { role, content: text, thinking: thinking || undefined }
        if (role === 'assistant') {
          base.usage = msg.usage
          base.model = msg.model
          base.timestamp = msg.timestamp
        } else if (role === 'user') {
          base.timestamp = msg.timestamp
        }
        messages.push(base)
      } else if (role === 'toolResult') {
        let text = ''
        for (const c of msg.content || []) {
          if (c.type === 'text') text += c.text || ''
        }
        const entry = msg.toolCallId ? pendingCallArgs.get(msg.toolCallId) : undefined
        messages.push({
          role: 'toolResult',
          content: text || '(no output)',
          toolName: msg.toolName || entry?.toolName || 'unknown',
          toolCallId: msg.toolCallId,
          isError: msg.isError || false,
          callArgs: entry?.args,
        })
        if (msg.toolCallId) pendingCallArgs.delete(msg.toolCallId)
      }
    } catch {
      continue
    }
  }

  // 未匹配的 toolCall（被中断的工具调用）
  for (const [, entry] of pendingCallArgs) {
    messages.push({
      role: 'toolCall',
      content: entry.args,
      toolName: entry.toolName,
      isError: true,
    })
  }

  return messages
}

/**
 * 增量读取消息 — 只返回行号 > since 的新增消息
 *
 * @param sessionFile 会话文件路径
 * @param since 前端已处理的最后行号（0-based），不传则全量
 * @returns messages 新增消息列表，totalLines 当前文件总行数，reset 为 true 表示文件已重建
 */
export function getMessagesIncremental(sessionFile: string, since?: number): {
  messages: HistoryMessage[]
  totalLines: number
  reset?: boolean
} {
  const fullPath = resolvePath(sessionFile)
  const content = readFileSync(fullPath, 'utf-8')
  const lines = content.split('\n').filter(l => l.trim())
  const totalLines = lines.length

  // 如果 since >= totalLines，说明文件被重建/截断
  if (since !== undefined && since >= totalLines) {
    return { messages: [], totalLines, reset: true }
  }

  // 全量模式直接复用 getMessages
  if (since === undefined) {
    return { messages: getMessages(sessionFile), totalLines }
  }

  // 增量模式：从 since + 1 行开始解析
  const messages: HistoryMessage[] = []
  const pendingCallArgs = new Map<string, { args: string; toolName: string }>()
  const startLine = since + 1 // since 是已处理的最后行号，+1 是下一行

  for (let i = startLine; i < totalLines; i++) {
    const line = lines[i].trim()
    if (!line) continue

    try {
      const data = JSON.parse(line)
      const type = data.type

      // 非 message 事件 → system 提示
      if (type === 'model_change') {
        messages.push({ role: 'system', content: `切换模型: ${data.provider}/${data.modelId}`, timestamp: new Date(data.timestamp).getTime() })
        continue
      }
      if (type === 'thinking_level_change') {
        messages.push({ role: 'system', content: `思考模式: ${data.thinkingLevel}`, timestamp: new Date(data.timestamp).getTime() })
        continue
      }
      if (type === 'session_info') {
        messages.push({ role: 'system', content: `重命名: ${data.name}`, timestamp: new Date(data.timestamp).getTime() })
        continue
      }
      if (type === 'context_compress') {
        messages.push({ role: 'system', content: data.summary, timestamp: new Date(data.timestamp).getTime() })
        continue
      }
      if (type !== 'message') continue

      const msg = data.message
      const role = msg.role

      if (role === 'user' || role === 'assistant') {
        let text = ''
        let thinking = ''

        for (const c of msg.content || []) {
          if (c.type === 'text') text += c.text || ''
          else if (c.type === 'thinking') thinking += c.thinking || ''
          else if (c.type === 'toolCall') {
            const argsStr = typeof c.arguments === 'string' ? c.arguments : JSON.stringify(c.arguments || '')
            const toolCallId = c.id || ''
            const toolName = c.name || 'unknown'
            if (toolCallId) pendingCallArgs.set(toolCallId, { args: argsStr, toolName })
          }
        }

        if (!text && !thinking) continue

        const base: HistoryMessage = { role, content: text, thinking: thinking || undefined }
        if (role === 'assistant') {
          base.usage = msg.usage
          base.model = msg.model
          base.timestamp = msg.timestamp
        } else if (role === 'user') {
          base.timestamp = msg.timestamp
        }
        messages.push(base)
      } else if (role === 'toolResult') {
        let text = ''
        for (const c of msg.content || []) {
          if (c.type === 'text') text += c.text || ''
        }
        const entry = msg.toolCallId ? pendingCallArgs.get(msg.toolCallId) : undefined
        messages.push({
          role: 'toolResult',
          content: text || '(no output)',
          toolName: msg.toolName || entry?.toolName || 'unknown',
          toolCallId: msg.toolCallId,
          isError: msg.isError || false,
          callArgs: entry?.args,
        })
        if (msg.toolCallId) pendingCallArgs.delete(msg.toolCallId)
      }
    } catch {
      continue
    }
  }

  // 未匹配的 toolCall（被中断的工具调用）
  for (const [, entry] of pendingCallArgs) {
    messages.push({
      role: 'toolCall',
      content: entry.args,
      toolName: entry.toolName,
      isError: true,
    })
  }

  return { messages, totalLines }
}

/**
 * 获取会话的上下文使用情况（从最新 assistant 消息提取）
 */
export function getContext(sessionFile: string): SessionContext {
  const fullPath = resolvePath(sessionFile)
  const content = readFileSync(fullPath, 'utf-8')
  const lines = content.split('\n').filter(l => l.trim())

  let usedTokens = 0
  let cacheTokens = 0
  let contextWindow = 1000000
  let messageCount = 0

  for (const line of lines) {
    try {
      const data = JSON.parse(line)
      if (data.type !== 'message') continue
      messageCount++
      const msg = data.message
      if (msg.role === 'assistant' && msg.usage) {
        usedTokens = msg.usage.totalTokens || msg.usage.input || 0
        cacheTokens = msg.usage.cacheRead || 0
      }
    } catch {}
  }

  return { usedTokens, contextWindow, messageCount, cacheTokens }
}

/**
 * 压缩上下文：用 AI 摘要替换历史消息
 *
 * @param sessionFile 会话文件
 * @param summary AI 生成的对话摘要
 * @param keepCount 保留的最近消息条数
 */
export function compressMessages(sessionFile: string, summary: string, keepCount = 20): { messages: HistoryMessage[]; totalLines: number } {
  const fullPath = resolvePath(sessionFile)
  const content = readFileSync(fullPath, 'utf-8')
  const lines = content.split('\n').filter(l => l.trim())

  // 保留 session header + 最近 keepCount 行
  const header = lines[0]
  const recentLines = lines.slice(-keepCount)

  const newLines = [
    header,
    JSON.stringify({
      type: 'context_compress',
      summary: `【对话摘要】${summary}`,
      timestamp: new Date().toISOString(),
    }),
    ...recentLines,
  ]

  writeFileSync(fullPath, newLines.join('\n') + '\n')

  return getMessagesIncremental(sessionFile)
}
