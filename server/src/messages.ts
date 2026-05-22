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
  role: 'user' | 'assistant' | 'toolCall' | 'toolResult' | 'system'
  content: string
  thinking?: string
  toolName?: string     // toolResult 和 toolCall 用
  toolCallId?: string   // toolResult 和 toolCall 用
  isError?: boolean     // toolResult 执行出错
  usage?: Usage         // assistant 消息的 token 用量
  model?: string        // assistant 消息使用的模型
  timestamp?: number    // 消息时间戳
  callArgs?: string     // toolResult 对应的调用参数（JSON 字符串），用于显示摘要
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
  // 缓存从 assistant 中提取的工具调用参数，key=toolCallId
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
