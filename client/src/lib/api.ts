// ===== API 类型 =====

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

export interface HistoryMessage {
  role: 'user' | 'assistant' | 'toolCall' | 'toolResult'
  content: string
  thinking?: string
  toolName?: string
  toolCallId?: string
  isError?: boolean
}

export type PoolStatus = 'stopped' | 'starting' | 'ready'

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
