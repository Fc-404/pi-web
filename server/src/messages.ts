import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const SESSION_DIR = join(homedir(), '.pi', 'agent', 'sessions')

export interface HistoryMessage {
  role: 'user' | 'assistant' | 'toolCall' | 'toolResult'
  content: string
  thinking?: string
  toolName?: string     // toolResult 和 toolCall 用
  toolCallId?: string   // toolResult 和 toolCall 用
  isError?: boolean     // toolResult 执行出错
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
        messages.push({ role, content: text, thinking: thinking || undefined })
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
