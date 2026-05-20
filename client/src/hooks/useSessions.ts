import { useState, useEffect, useCallback } from 'react'
import { fetchSessions, newSession, deleteSession, type SessionGroup } from '../lib/api'

/**
 * 会话列表管理
 */
export function useSessions() {
  const [groups, setGroups] = useState<SessionGroup[]>([])
  const [loading, setLoading] = useState(true)

  // 加载列表
  const refresh = useCallback(async () => {
    try {
      const g = await fetchSessions()
      setGroups(g)
    } catch {}
  }, [])

  useEffect(() => {
    fetchSessions().then(g => {
      setGroups(g)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  // 新建会话
  const create = useCallback(async () => {
    const data = await newSession()
    await refresh()
    return data
  }, [refresh])

  // 删除会话
  const remove = useCallback(async (sessionFile: string) => {
    await deleteSession(sessionFile)
    await refresh()
  }, [refresh])

  return { groups, loading, refresh, create, remove }
}
