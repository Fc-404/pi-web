/**
 * useSessionManager — 会话状态管理（聚合层）
 *
 * 聚合 useSessions + usePoolStatus，提供统一的会话操作接口。
 * 消除 App.tsx 中与会话管理相关的重复逻辑和手动协调。
 */

import { useState, useCallback, useMemo } from 'react'
import { useSessions } from './useSessions'
import { usePoolStatus } from './usePoolStatus'
import {
  openSession,
  switchSession,
  closeSession as closeSessionApi,
  closeAllSessions as closeAllSessionsApi,
  fetchSessionMessages,
  type SessionInfo,
  type PoolStatus,
  type HistoryMessage,
} from '../lib/api'

export interface SessionOperationResult {
  messages: HistoryMessage[]
  status: PoolStatus
}

export function useSessionManager() {
  // ── 子 hook ──
  const { groups, loading, refresh: refreshGroups, create, remove } = useSessions()
  const { poolStatus, activeId, setPoolStatus, setActiveId } = usePoolStatus()

  // ── UI 状态 ──
  const [switchingId, setSwitchingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  // ── 计算属性 ──
  const activeSession: SessionInfo | undefined = useMemo(() => {
    if (!activeId) return undefined
    for (const g of groups) {
      for (const s of g.sessions) {
        if (s.file === activeId) return s
      }
    }
    return undefined
  }, [activeId, groups])

  const totalSessions = useMemo(
    () => groups.reduce((s, g) => s + g.sessions.length, 0),
    [groups],
  )

  // ── 操作：打开或切换会话 ──
  const openOrSwitch = useCallback(
    async (sessionFile: string): Promise<SessionOperationResult> => {
      const currentStatus = poolStatus[sessionFile]
      if (currentStatus === 'starting' || currentStatus === 'ready') {
        await switchSession(sessionFile)
        const msgs = await fetchSessionMessages(sessionFile)
        return { messages: msgs, status: currentStatus }
      }

      const data = await openSession(sessionFile)
      setPoolStatus((prev) => ({ ...prev, [sessionFile]: data.status }))
      return { messages: data.messages || [], status: data.status }
    },
    [poolStatus, setPoolStatus],
  )

  // ── 操作：新建会话 ──
  const createSession = useCallback(async () => {
    setCreating(true)
    try {
      const data = await create()
      setPoolStatus((prev) => ({ ...prev, [data.sessionFile]: data.status }))
      return data
    } finally {
      setCreating(false)
    }
  }, [create, setPoolStatus])

  // ── 操作：删除会话 ──
  const deleteSession = useCallback(
    async (sessionFile: string): Promise<boolean> => {
      await remove(sessionFile)
      return activeId === sessionFile // 调用方需要据此清理消息
    },
    [remove, activeId],
  )

  // ── 操作：关闭会话 ──
  const closeSessionOp = useCallback(
    async (sessionFile: string): Promise<void> => {
      await closeSessionApi(sessionFile)
      setPoolStatus((prev) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [sessionFile]: _, ...rest } = prev
        return rest
      })
    },
    [setPoolStatus],
  )

  // ── 操作：关闭全部 ──
  const closeAllOp = useCallback(async (): Promise<void> => {
    await closeAllSessionsApi()
    setPoolStatus({})
  }, [setPoolStatus])

  // ── 操作：折叠组 ──
  const toggleGroup = useCallback((dir: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(dir)) next.delete(dir)
      else next.add(dir)
      return next
    })
  }, [])

  return {
    // 数据
    groups,
    loading,
    poolStatus,
    activeId,
    activeSession,
    totalSessions,

    // UI 状态
    switchingId,
    creating,
    collapsedGroups,

    // setter（供 App.tsx 覆盖或读取）
    setSwitchingId,
    setCreating,
    setCollapsedGroups,
    setPoolStatus,
    refreshGroups,

    // 操作
    openOrSwitch,
    createSession,
    deleteSession,
    closeSession: closeSessionOp,
    closeAllSessions: closeAllOp,
    toggleGroup,
  }
}
