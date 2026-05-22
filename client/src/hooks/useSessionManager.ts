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
  fetchSessionMessagesIncremental,
  type SessionInfo,
  type PoolStatus,
  type HistoryMessage,
} from '../lib/api'
import { getSessionCache, setSessionCache, deleteSessionCache } from '../lib/db'

export interface SessionOperationResult {
  messages: HistoryMessage[]
  status: PoolStatus
  fromCache?: boolean // 是否来自缓存（用于 UI 快速消除加载态）
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

  // ── 操作：打开或切换会话（集成 IndexedDB 缓存 + 增量同步） ──
  const openOrSwitch = useCallback(
    async (sessionFile: string): Promise<SessionOperationResult> => {
      // 1. 处理进程状态
      let status: PoolStatus
      if (poolStatus[sessionFile] === 'starting' || poolStatus[sessionFile] === 'ready') {
        await switchSession(sessionFile)
        status = poolStatus[sessionFile]
      } else {
        const data = await openSession(sessionFile)
        status = data.status
        setPoolStatus((prev) => ({ ...prev, [sessionFile]: status }))
      }

      // 2. 从缓存加载 + 增量同步
      const cached = await getSessionCache(sessionFile)

      if (cached) {
        const result = await fetchSessionMessagesIncremental(sessionFile, cached.lastSeq)
        if (result.reset) {
          // 文件被重建 → 全量重拉
          const msgs = await fetchSessionMessages(sessionFile)
          await setSessionCache(sessionFile, {
            messages: msgs,
            lastSeq: result.totalLines - 1,
            totalLines: result.totalLines,
          })
          return { messages: msgs, status }
        } else if (result.messages.length > 0) {
          // 有新增 → 合并缓存
          const newMessages = [...cached.messages, ...result.messages]
          await setSessionCache(sessionFile, {
            messages: newMessages,
            lastSeq: result.totalLines - 1,
            totalLines: result.totalLines,
          })
          return { messages: newMessages, status }
        } else {
          // 无新增 → 直接用缓存，标记 fromCache
          return { messages: cached.messages, status, fromCache: true }
        }
      } else {
        // 无缓存 → 全量拉取 + 写入缓存
        const msgs = await fetchSessionMessages(sessionFile)
        // 尝试建立缓存（失败不影响消息展示）
        try {
          const info = await fetchSessionMessagesIncremental(sessionFile)
          await setSessionCache(sessionFile, {
            messages: msgs,
            lastSeq: info.totalLines - 1,
            totalLines: info.totalLines,
          })
        } catch (e) {
          console.warn('[缓存] 写入失败:', e)
        }
        return { messages: msgs, status }
      }
    },
    [poolStatus, setPoolStatus],
  )

  // ── 操作：新建会话（写入空缓存） ──
  const createSession = useCallback(async () => {
    setCreating(true)
    try {
      const data = await create()
      setPoolStatus((prev) => ({ ...prev, [data.sessionFile]: data.status }))
      // 新建会话消息为空，写入空缓存
      await setSessionCache(data.sessionFile, {
        messages: [],
        lastSeq: 0,
        totalLines: 1, // 仅 session header 一行
      })
      return data
    } finally {
      setCreating(false)
    }
  }, [create, setPoolStatus])

  // ── 操作：删除会话（清除缓存） ──
  const deleteSession = useCallback(
    async (sessionFile: string): Promise<boolean> => {
      await remove(sessionFile)
      await deleteSessionCache(sessionFile)
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
