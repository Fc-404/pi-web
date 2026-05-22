import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const SESSION_DIR = join(homedir(), '.pi', 'agent', 'sessions')

export interface Usage {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  totalTokens: number
  cost: {
    input: number
    output: number
    cacheRead: number
    total: number
  }
}

export interface HistoryMessage {
  role: 'user' | 'assistant' | 'toolCall' | 'toolResult'
  content: string
  thinking?: string
  toolName?: string     // toolResult 和 toolCall 用
  toolCallId?: string   // toolResult 和 toolCall 用
  isError?: boolean     // toolResult 执行出错
  usage?: Usage         // assistant 消息的 token 用量
  model?: string        // assistant 消息使用的模型
  timestamp?: number    // 消息时间戳
}

/**
 * 从 jsonl 会话文件中读取历史消息
 */
export function getSessionMessages(sessionFile: string): HistoryMessage[] {
  const fullPath = sessionFile.startsWith('/')
    ? sessionFile
    : join(SESSION_DIR, sessionFile)

  const content = readFileSync(fullPath, 'utf-8')
  const lines = content.split('\n').filter(l => l.trim())

  const messages: HistoryMessage[] = []

  for (const line of lines) {
    try {
      const data = JSON.parse(line)
      if (data.type !== 'message') continue

      const msg = data.message
      const role = msg.role

      if (role === 'user' || role === 'assistant') {
        let text = ''
        let thinking = ''
        for (const c of msg.content || []) {
          if (c.type === 'text') text += c.text || ''
          else if (c.type === 'thinking') thinking += c.thinking || ''
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
        messages.push({
          role: 'toolResult',
          content: text || '(no output)',
          toolName: msg.toolName || 'unknown',
          toolCallId: msg.toolCallId,
          isError: msg.isError || false,
        })
      } else if (role === 'toolCall') {
        const funcName = msg.function?.name || msg.toolName || 'unknown'
        const args = msg.function?.arguments || msg.arguments || ''
        messages.push({
          role: 'toolCall',
          content: typeof args === 'string' ? args : JSON.stringify(args),
          toolName: funcName,
          toolCallId: msg.id || msg.toolCallId,
        })
      }
    } catch {
      continue
    }
  }

  return messages
}

/**
 * 获取会话的上下文使用情况（从最新 assistant 消息提取）
 */
export function getSessionContext(sessionFile: string): {
  usedTokens: number
  contextWindow: number
  messageCount: number
  cacheTokens: number
} {
  const fullPath = sessionFile.startsWith('/')
    ? sessionFile
    : join(SESSION_DIR, sessionFile)

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
      if (data.type === 'model_change' && data.model) {
        // 可以从 model_change 事件获取 contextWindow
        // 但 contextWindow 不在 model_change 中，用默认值
      }
    } catch {}
  }

  return { usedTokens, contextWindow, messageCount, cacheTokens }
}
