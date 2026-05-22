/**
 * pi-web 共享类型
 *
 * 前后端共用的核心类型定义，避免重复和漂移。
 * 后端 import 需加 .js 后缀，前端不需要。
 */

// ===== 会话 =====

export interface SessionInfo {
  id: string
  file: string
  startedAt: string
  title: string
  isEmpty: boolean
}

export interface SessionGroup {
  dir: string
  cwd: string
  sessions: SessionInfo[]
}

export type SessionStatus = 'stopped' | 'starting' | 'ready'

// ===== 消息 =====

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
  toolName?: string
  toolCallId?: string
  isError?: boolean
  usage?: Usage
  model?: string
  timestamp?: number
  callArgs?: string
}

export interface SessionContext {
  usedTokens: number
  contextWindow: number
  messageCount: number
  cacheTokens: number
}
