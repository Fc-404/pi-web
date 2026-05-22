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

// ===== API 调用 =====

export async function fetchSessions(): Promise<SessionGroup[]> {
  const res = await fetch('/api/sessions')
  const data = await res.json()
  return data.groups
}

export async function fetchSessionStatus(): Promise<{
  statuses: Array<{ file: string; status: PoolStatus }>
  activeId: string | null
}> {
  const res = await fetch('/api/sessions/status')
  return res.json()
}

export async function openSession(sessionFile: string): Promise<{
  messages: HistoryMessage[]
  status: PoolStatus
}> {
  const res = await fetch('/api/sessions/open', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionFile }),
  })
  if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
  return res.json()
}

export async function switchSession(sessionFile: string): Promise<void> {
  await fetch('/api/sessions/switch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionFile }),
  })
}

export async function closeSession(sessionFile: string): Promise<void> {
  await fetch('/api/sessions/close', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionFile }),
  })
}

export async function deleteSession(sessionFile: string): Promise<void> {
  await fetch('/api/sessions/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionFile }),
  })
}

export async function closeAllSessions(): Promise<void> {
  await fetch('/api/sessions/close-all', { method: 'POST' })
}

export async function newSession(): Promise<{
  success: boolean
  sessionFile: string
  messages: HistoryMessage[]
  status: PoolStatus
}> {
  const res = await fetch('/api/sessions/new', { method: 'POST' })
  if (!res.ok) throw new Error('Failed to create session')
  return res.json()
}

export async function fetchSessionMessages(sessionFile: string): Promise<HistoryMessage[]> {
  const res = await fetch(`/api/sessions/messages?file=${encodeURIComponent(sessionFile)}`)
  if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
  const data = await res.json()
  return data.messages || []
}

export async function fetchSessionMessagesWithProgress(
  sessionFile: string,
  onProgress: (loaded: number, total: number) => void
): Promise<HistoryMessage[]> {
  const res = await fetch(`/api/sessions/messages?file=${encodeURIComponent(sessionFile)}`)
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

export async function updateSessionSettings(sessionFile: string, settings: {
  modelId?: string
  thinkingLevel?: string
}): Promise<void> {
  const res = await fetch('/api/sessions/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionFile, ...settings }),
  })
  if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
}
