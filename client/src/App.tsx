import { useState, useCallback, useEffect, useRef } from 'react'
import { LoginPage } from './components/LoginPage'
import { ConfigPage } from './components/ConfigPage'
import { isLoggedIn } from './lib/auth'
import { setOnUnauthorized } from './lib/api'
import { ToastProvider } from './components/Toast'

function App() {
  const [loggedIn, setLoggedIn] = useState(isLoggedIn())
  const [configOpen, setConfigOpen] = useState(false)

  useEffect(() => {
    setOnUnauthorized(() => setLoggedIn(false))
  }, [])

  // 未登录 → 登录页（不渲染任何 API 相关 hooks）
  if (!loggedIn) return <LoginPage onLogin={() => setLoggedIn(true)} />

  // 配置页
  if (configOpen) return <ConfigPage onClose={() => setConfigOpen(false)} />

  // 主界面（所有 hooks 都在这里，登录后才渲染）
  return (
    <ToastProvider>
      <ChatApp onOpenConfig={() => setConfigOpen(true)} />
    </ToastProvider>
  )
}

export default App

// ===== 主界面（登录后渲染） =====

import { Button } from '@/components/ui/button'
import { Sidebar } from './components/Sidebar'
import { ChatHeader } from './components/ChatHeader'
import { ChatMessages } from './components/ChatMessages'
import { ChatInput } from './components/ChatInput'
import { ChatContextProvider } from './hooks/useChatContext'
import { ConfirmDialog } from './components/ConfirmDialog'
import { useChat } from './hooks/useChat'
import { useSessionManager } from './hooks/useSessionManager'
import { fetchSessionMessages, fetchSessionMessagesIncremental, fetchSessionMessagesWithProgress, updateSessionSettings, type SessionInfo } from './lib/api'
import { getSessionCache, setSessionCache } from './lib/db'
import { LoadingDots } from './components/LoadingDots'
import { SettingsPanel } from './components/SettingsPanel'
import { useToast } from './components/Toast'

function ChatApp({ onOpenConfig }: { onOpenConfig: () => void }) {
  const { showToast } = useToast()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const handleOpenSettings = useCallback(() => setSettingsOpen(true), [])
  const handleCloseSettings = useCallback(() => setSettingsOpen(false), [])

  // ── 会话管理（聚合层） ──
  const {
    groups, poolStatus, activeId, activeSession, totalSessions,
    loading: sessionsLoading,
    switchingId, creating, collapsedGroups,
    setSwitchingId, setCreating, setPoolStatus, refreshGroups,
    openOrSwitch, createSession, deleteSession,
    closeSession: closeSessionOp, closeAllSessions, toggleGroup,
  } = useSessionManager()

  // ── 聊天（独立） ──
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

  // 通用：带进度 + 完成绿色延迟 800ms 的消息加载
  const loadWithProgress = useCallback(async (file: string) => {
    const msgs = await fetchSessionMessagesWithProgress(file, (loaded, total) => {
      setLoadProgress({ loaded, total })
    })
    setLoadProgress({ loaded: 1, total: 1 })
    return msgs
  }, [])

  // ── 会话操作 ──

  // 点击会话
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

  // 新建会话
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

  // 删除会话
  const handleDelete = useCallback(async (sessionFile: string) => {
    setConfirmDelete(null)
    try {
      const shouldClear = await deleteSession(sessionFile)
      if (shouldClear) clearMessages()
      showToast('会话已删除', 'success')
    } catch { showToast('删除失败', 'error') }
  }, [deleteSession, clearMessages, showToast])

  // 关闭当前活跃会话
  const handleClose = useCallback(async () => {
    if (!activeId) return
    try {
      await closeSessionOp(activeId)
      clearMessages()
      showToast('会话已关闭', 'info')
    } catch { showToast('关闭会话失败', 'error') }
  }, [activeId, closeSessionOp, clearMessages, showToast])

  // 关闭指定会话
  const handleCloseSession = useCallback(async (sessionFile: string) => {
    try {
      await closeSessionOp(sessionFile)
      if (activeId === sessionFile) clearMessages()
      showToast('会话已终止', 'info')
    } catch { showToast('终止会话失败', 'error') }
  }, [activeId, closeSessionOp, clearMessages, showToast])

  // 关闭全部
  const handleCloseAll = useCallback(async () => {
    try {
      await closeAllSessions()
      clearMessages()
      showToast('已关闭全部会话', 'info')
    } catch { showToast('关闭全部会话失败', 'error') }
  }, [closeAllSessions, clearMessages, showToast])

  // 自动加载
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

  // 获取当前思考级别 + 上下文使用情况
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

  // 重命名会话
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

  // 发消息
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

  const isLoading = switchingId !== null || autoLoading

  const title = activeSession?.title
    ? (activeSession.title.length > 9 ? activeSession.title.slice(0, 8) + '...' : activeSession.title)
    : ''

  if (sessionsLoading) return (
    <div className="h-dvh bg-zinc-50 flex items-center justify-center">
      <div className="text-zinc-400 animate-pulse">加载中...</div>
    </div>
  )

  return (
    <div className="h-dvh bg-white text-zinc-800 flex flex-col overflow-hidden">
      {confirmDelete && (
        <ConfirmDialog
          title="删除会话"
          message="确定要删除这个会话吗？删除后无法恢复。"
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      <SettingsPanel
        open={settingsOpen}
        onClose={handleCloseSettings}
        onApply={async (s) => {
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
        }}
        activeId={activeId}
      />

      {creating && (
        <div className="fixed inset-0 z-[100] bg-white/80 backdrop-blur-sm flex items-center justify-center">
          <LoadingDots label="正在新建会话..." />
        </div>
      )}

      {!activeSession && (
        <header className="flex md:hidden items-center gap-2 px-4 py-3 border-b border-zinc-200 bg-white flex-shrink-0">
          <Button variant="ghost" size="icon-sm" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </Button>
          <span className="text-sm text-zinc-400">pi-web</span>
        </header>
      )}

      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar
          groups={groups}
          collapsedGroups={collapsedGroups}
          poolStatus={poolStatus}
          activeId={activeId}
          switchingId={switchingId}
          totalSessions={totalSessions}
          sidebarOpen={sidebarOpen}
          onToggleGroup={toggleGroup}
          onSessionClick={handleSessionClick}
          onDelete={setConfirmDelete}
          onNew={handleNewSession}
          onCloseAll={handleCloseAll}
          onCloseSidebar={() => setSidebarOpen(false)}
          onClose={handleCloseSession}
          onOpenConfig={onOpenConfig}
        />

        <main className="flex-1 flex flex-col min-w-0">
          {activeId ? (
            <ChatContextProvider value={{
              messages: chatMessages, streaming, chatError: error,
              activeStatus, loading: isLoading, loadProgress,
              thinkingLevel, contextUsed, contextWindow,
              input, title,
              onInputChange: setInput, onSend: handleSend,
              onStop: stopGeneration, onRename: handleRename,
              onOpenSettings: handleOpenSettings,
              onToggleSidebar: () => setSidebarOpen(v => !v),
              loadingLabel: isLoading ? (
                loadProgress
                  ? `正在加载 ${(loadProgress.loaded / 1024).toFixed(0)}KB / ${(loadProgress.total / 1024).toFixed(0)}KB`
                  : '正在加载...'
              ) : undefined,
            }}>
              <ChatHeader />
              <ChatMessages />
              <ChatInput />
            </ChatContextProvider>
          ) : (
            <div className="hidden md:flex flex-1 items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-zinc-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-zinc-400 text-sm">选择一个会话开始</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
