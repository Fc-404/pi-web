// ===== API 类型（共享自 @pi-web/shared） =====

import type {
  SessionInfo as _SessionInfo,
  SessionGroup as _SessionGroup,
  HistoryMessage as _HistoryMessage,
  SessionStatus as _SessionStatus,
} from '@pi-web/shared'

export type SessionInfo = _SessionInfo
export type SessionGroup = _SessionGroup
export type HistoryMessage = _HistoryMessage
export type PoolStatus = _SessionStatus

// ===== 统一请求封装（自动带 token + 处理 401） =====

import { getToken, clearToken } from './auth'

/** 由 App.tsx 设置，收到 401 时跳转登录页 */
export let onUnauthorized: (() => void) | null = null

export function setOnUnauthorized(fn: () => void) {
  onUnauthorized = fn
}

async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  const token = getToken()
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string> || {}),
  }
  // 避免覆盖 Content-Type
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (!headers['Content-Type'] && options?.method !== 'GET' && options?.method !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(url, { ...options, headers })

  if (res.status === 401) {
    clearToken()
    onUnauthorized?.()
    throw new Error('登录已过期')
  }

  return res
}

// ===== API 调用 =====

export async function fetchSessions(): Promise<SessionGroup[]> {
  const res = await apiFetch('/api/sessions')
  const data = await res.json()
  return data.groups
}

export async function fetchSessionStatus(): Promise<{
  statuses: Array<{ file: string; status: PoolStatus }>
  activeId: string | null
}> {
  const res = await apiFetch('/api/sessions/status')
  return res.json()
}

export async function openSession(sessionFile: string): Promise<{
  messages: HistoryMessage[]
  status: PoolStatus
}> {
  const res = await apiFetch('/api/sessions/open', {
    method: 'POST',
    body: JSON.stringify({ sessionFile }),
  })
  if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
  return res.json()
}

export async function switchSession(sessionFile: string): Promise<void> {
  await apiFetch('/api/sessions/switch', {
    method: 'POST',
    body: JSON.stringify({ sessionFile }),
  })
}

export async function closeSession(sessionFile: string): Promise<void> {
  await apiFetch('/api/sessions/close', {
    method: 'POST',
    body: JSON.stringify({ sessionFile }),
  })
}

export async function deleteSession(sessionFile: string): Promise<void> {
  await apiFetch('/api/sessions/delete', {
    method: 'POST',
    body: JSON.stringify({ sessionFile }),
  })
}

export async function closeAllSessions(): Promise<void> {
  await apiFetch('/api/sessions/close-all', { method: 'POST' })
}

export async function newSession(): Promise<{
  success: boolean
  sessionFile: string
  messages: HistoryMessage[]
  status: PoolStatus
}> {
  const res = await apiFetch('/api/sessions/new', { method: 'POST' })
  if (!res.ok) throw new Error('Failed to create session')
  return res.json()
}

export interface IncrementalResult {
  messages: HistoryMessage[]
  totalLines: number
  reset?: boolean
}

export async function fetchSessionMessages(sessionFile: string): Promise<HistoryMessage[]> {
  const res = await apiFetch(`/api/sessions/messages?file=${encodeURIComponent(sessionFile)}`)
  if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
  const data = await res.json()
  return data.messages || []
}

/**
 * 增量拉取消息
 * @param since 可选，传则只返回行号 > since 的新消息；不传则全量 + totalLines
 */
export async function fetchSessionMessagesIncremental(
  sessionFile: string,
  since?: number
): Promise<IncrementalResult> {
  let url = `/api/sessions/messages?file=${encodeURIComponent(sessionFile)}`
  // 保护：只有有效时才拼接 since 参数
  if (since !== undefined && !isNaN(since) && since >= 0) url += `&since=${since}`
  const res = await apiFetch(url)
  if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
  return res.json()
}

export async function fetchSessionMessagesWithProgress(
  sessionFile: string,
  onProgress: (loaded: number, total: number) => void
): Promise<HistoryMessage[]> {
  const res = await apiFetch(`/api/sessions/messages?file=${encodeURIComponent(sessionFile)}`)
  if (!res.ok) { const d = await res.json(); throw new Error(d.error) }

  const total = parseInt(res.headers.get('Content-Length') || '0', 10)
  const reader = res.body!.getReader()
  let received = 0
  const chunks: Uint8Array[] = []

  // 先给一个初始进度
  if (total > 0) onProgress(0, total)

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value && value.length > 0) {
      chunks.push(value)
      received += value.length
      // 每收到一个 chunk 就更新进度
      if (total > 0) onProgress(received, total)
    }
  }

  // 确保最后显示 100%
  if (total > 0) onProgress(total, total)

  const allBytes = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) {
    allBytes.set(chunk, offset)
    offset += chunk.length
  }
  const text = new TextDecoder().decode(allBytes)
  return JSON.parse(text).messages || []
}

/** 压缩当前会话上下文 */
export async function compressSession(): Promise<HistoryMessage[]> {
  const res = await apiFetch('/api/chat/compress', { method: 'POST' })
  if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
  const data = await res.json()
  return data.messages || []
}

export async function updateSessionSettings(sessionFile: string, settings: {
  modelId?: string
  thinkingLevel?: string
}): Promise<void> {
  const res = await apiFetch('/api/sessions/settings', {
    method: 'POST',
    body: JSON.stringify({ sessionFile, ...settings }),
  })
  if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
}
