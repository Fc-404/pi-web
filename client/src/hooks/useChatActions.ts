/**
 * useChatActions — 聊天/配置模式的所有业务逻辑
 *
 * 提取自 MainLayout，让布局组件只负责 UI 组装。
 * 包含：会话操作、聊天操作、自动加载、状态轮询等。
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import { useChat } from './useChat'
import { useSessionManager } from './useSessionManager'
import {
  fetchSessionMessages, fetchSessionMessagesIncremental,
  fetchSessionMessagesWithProgress, updateSessionSettings,
  type SessionInfo,
} from '../lib/api'
import { getSessionCache, setSessionCache } from '../lib/db'
import { useToast } from '../components/Toast'

export type Mode = 'chat' | 'config'

export function useChatActions() {
  const { showToast } = useToast()
  const [mode, setMode] = useState<Mode>('chat')
  const [settingsOpen, setSettingsOpen] = useState(false)

  // ── 会话管理 ──
  const {
    groups, poolStatus, activeId, activeSession, totalSessions,
    loading: sessionsLoading,
    switchingId, creating, collapsedGroups,
    setSwitchingId, setCreating, setPoolStatus, refreshGroups,
    openOrSwitch, createSession, deleteSession,
    closeSession: closeSessionOp, closeAllSessions, toggleGroup,
  } = useSessionManager()

  // ── 聊天 ──
  const { chatMessages, streaming, error, setError, sendMessage, clearMessages, replaceMessages, stopGeneration } = useChat()

  // ── UI 状态 ──
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [autoLoading, setAutoLoading] = useState(false)
  const [loadProgress, setLoadProgress] = useState<{ loaded: number; total: number } | null>(null)
  const [thinkingLevel, setThinkingLevel] = useState('high')
  const [contextUsed, setContextUsed] = useState(0)
  const [contextWindow, setContextWindow] = useState(1000000)

  const activeStatus = activeId ? poolStatus[activeId] : undefined
  const isLoading = switchingId !== null || autoLoading
  const title = activeSession?.title
    ? (activeSession.title.length > 9 ? activeSession.title.slice(0, 8) + '...' : activeSession.title)
    : ''

  // ── 带进度的消息加载 ──
  const loadWithProgress = useCallback(async (file: string) => {
    const msgs = await fetchSessionMessagesWithProgress(file, (loaded, total) => {
      setLoadProgress({ loaded, total })
    })
    setLoadProgress({ loaded: 1, total: 1 })
    return msgs
  }, [])

  // ── 会话操作 ──

  const handleSessionClick = useCallback(async (session: SessionInfo) => {
    setSwitchingId(session.id)
    setSidebarOpen(false)
    setError(null)
    clearMessages()
    setLoadProgress(null)

    let fromCache = false
    try {
      const result = await openOrSwitch(session.file)
      fromCache = result.fromCache ?? false
      replaceMessages(result.messages)
      setPoolStatus((prev) => ({ ...prev, [session.file]: result.status }))
    } catch (err: any) {
      setError(err.message)
    }

    const delay = fromCache ? 200 : 800
    setTimeout(() => { setSwitchingId(null); setLoadProgress(null) }, delay)
    setTimeout(() => window.scrollTo(0, document.body.scrollHeight), 50)
  }, [openOrSwitch, setSwitchingId, setPoolStatus, setError, clearMessages, replaceMessages])

  const handleNewSession = useCallback(async () => {
    setCreating(true)
    setError(null)
    try {
      const data = await createSession()
      replaceMessages(data.messages || [])
      showToast('新会话已创建', 'success')
    } catch (err: any) {
      setError(err.message)
      showToast('创建会话失败', 'error')
    }
  }, [createSession, replaceMessages, setError, showToast, setCreating])

  const handleDelete = useCallback(async (sessionFile: string) => {
    setConfirmDelete(null)
    try {
      const shouldClear = await deleteSession(sessionFile)
      if (shouldClear) clearMessages()
      showToast('会话已删除', 'success')
    } catch { showToast('删除失败', 'error') }
  }, [deleteSession, clearMessages, showToast])

  const handleCloseSession = useCallback(async (sessionFile: string) => {
    try {
      await closeSessionOp(sessionFile)
      if (activeId === sessionFile) clearMessages()
      showToast('会话已终止', 'info')
    } catch { showToast('终止会话失败', 'error') }
  }, [activeId, closeSessionOp, clearMessages, showToast])

  const handleCloseAll = useCallback(async () => {
    try {
      await closeAllSessions()
      clearMessages()
      showToast('已关闭全部会话', 'info')
    } catch { showToast('关闭全部会话失败', 'error') }
  }, [closeAllSessions, clearMessages, showToast])

  // ── 自动加载 ──
  const autoLoadedRef = useRef(false)
  useEffect(() => {
    if (sessionsLoading || !activeId || !activeSession || chatMessages.length > 0 || autoLoadedRef.current) return
    autoLoadedRef.current = true
    setAutoLoading(true)
    loadWithProgress(activeId).then(msgs => {
      if (msgs.length > 0) replaceMessages(msgs)
      fetchSessionMessagesIncremental(activeId)
        .then(info => { setSessionCache(activeId, { messages: msgs, lastSeq: info.totalLines - 1, totalLines: info.totalLines }) })
        .catch(() => {})
      setTimeout(() => { setAutoLoading(false); setLoadProgress(null) }, 800)
    }).catch(() => { setAutoLoading(false); setLoadProgress(null) })
  }, [sessionsLoading, activeId, activeSession, chatMessages.length, replaceMessages, loadWithProgress])

  // ── 思考和上下文 ──
  useEffect(() => {
    if (!activeId) return
    fetch(`/api/sessions/state?file=${encodeURIComponent(activeId)}`)
      .then(res => res.json())
      .then(data => { if (data.thinkingLevel) setThinkingLevel(data.thinkingLevel) })
      .catch(() => {})
    fetch(`/api/sessions/context?file=${encodeURIComponent(activeId)}`)
      .then(res => res.json())
      .then(data => {
        if (data.usedTokens !== undefined) setContextUsed(data.usedTokens)
        if (data.contextWindow) setContextWindow(data.contextWindow)
      })
      .catch(() => {})
  }, [activeId])

  // ── 重命名 ──
  const handleRename = useCallback(async (newName: string) => {
    if (!activeId) return
    try {
      await fetch('/api/sessions/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionFile: activeId, name: newName }),
      })
    } catch {}
    refreshGroups()
  }, [activeId, refreshGroups])

  // ── 发消息 ──
  const handleSend = useCallback(() => {
    sendMessage(input, activeId, async () => {
      if (activeId) {
        try {
          const cached = await getSessionCache(activeId)
          if (cached) {
            const result = await fetchSessionMessagesIncremental(activeId, cached.lastSeq)
            if (result.reset) {
              const msgs = await fetchSessionMessages(activeId)
              const info = await fetchSessionMessagesIncremental(activeId)
              await setSessionCache(activeId, { messages: msgs, lastSeq: info.totalLines - 1, totalLines: info.totalLines })
              replaceMessages(msgs)
            } else if (result.messages.length > 0) {
              const newMessages = [...cached.messages, ...result.messages]
              await setSessionCache(activeId, { messages: newMessages, lastSeq: result.totalLines - 1, totalLines: result.totalLines })
              replaceMessages(newMessages)
            }
          } else {
            const msgs = await fetchSessionMessages(activeId)
            const info = await fetchSessionMessagesIncremental(activeId)
            await setSessionCache(activeId, { messages: msgs, lastSeq: info.totalLines - 1, totalLines: info.totalLines })
            replaceMessages(msgs)
          }
        } catch {}
      }
    })
    setInput('')
  }, [input, activeId, sendMessage, replaceMessages])

  // ── 设置面板 ──
  const handleOpenSettings = useCallback(() => setSettingsOpen(true), [])
  const handleCloseSettings = useCallback(() => setSettingsOpen(false), [])

  const handleApplySettings = useCallback(async (s: { modelId?: string; thinkingLevel: string }) => {
    if (!activeId) return
    try {
      await updateSessionSettings(activeId, {
        modelId: s.modelId || undefined,
        thinkingLevel: s.thinkingLevel,
      })
      setThinkingLevel(s.thinkingLevel)
      showToast('设置已应用', 'success')
    } catch (err: any) {
      showToast('应用设置失败: ' + (err.message || '未知错误'), 'error')
    }
  }, [activeId, showToast])

  return {
    // 数据
    groups, poolStatus, activeId, activeSession, totalSessions,
    sessionsLoading, switchingId, creating, collapsedGroups,
    chatMessages, streaming, error, activeStatus,
    sidebarOpen, confirmDelete, input, autoLoading, loadProgress,
    thinkingLevel, contextUsed, contextWindow,
    isLoading, title, mode, settingsOpen,

    // 状态设值（供 UI 绑定）
    setSidebarOpen, setConfirmDelete, setInput, setError,
    setCreating, setSwitchingId, setPoolStatus,
    setMode, setThinkingLevel,

    // 操作
    handleSessionClick, handleNewSession, handleDelete,
    handleCloseSession, handleCloseAll, handleRename,
    handleSend, stopGeneration, toggleGroup,
    handleOpenSettings, handleCloseSettings, handleApplySettings,
  }
}
