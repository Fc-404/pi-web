import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Sidebar } from './components/Sidebar'
import { ChatArea } from './components/ChatArea'
import { ConfirmDialog } from './components/ConfirmDialog'
import { useSessions } from './hooks/useSessions'
import { usePoolStatus } from './hooks/usePoolStatus'
import { useChat } from './hooks/useChat'
import { useSessionActions } from './hooks/useSessionActions'
import { openSession, fetchSessionMessages, type SessionInfo, type PoolStatus } from './lib/api'

function App() {
  // 数据层
  const { groups, loading, refresh, create, remove } = useSessions()
  const { poolStatus, activeId, setPoolStatus } = usePoolStatus()
  const { chatMessages, streaming, error, setError, sendMessage, clearMessages, replaceMessages, stopGeneration } = useChat()

  // UI 状态
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [switchingId, setSwitchingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  // 当前活跃会话信息
  const activeSession: SessionInfo | undefined = (() => {
    if (!activeId) return undefined
    for (const g of groups) for (const s of g.sessions) if (s.file === activeId) return s
    return undefined
  })()
  const activeStatus: PoolStatus | undefined = activeId ? poolStatus[activeId] : undefined

  const totalSessions = groups.reduce((s, g) => s + g.sessions.length, 0)

  // 会话操作
  const onMessagesLoaded = useCallback((msgs: any[]) => replaceMessages(msgs), [replaceMessages])
  const onStatusUpdate = useCallback((file: string, status: PoolStatus) => {
    setPoolStatus(prev => ({ ...prev, [file]: status }))
  }, [setPoolStatus])

  const actions = useSessionActions(poolStatus, onMessagesLoaded, onStatusUpdate)

  // 点击会话
  const handleSessionClick = useCallback(async (session: SessionInfo) => {
    setSwitchingId(session.id)
    setSidebarOpen(false)
    setError(null)

    const currentStatus = poolStatus[session.file]
    if (currentStatus === 'starting' || currentStatus === 'ready') {
      await fetch('/api/sessions/switch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionFile: session.file }),
      })
      const msgs = await fetchSessionMessages(session.file)
      onMessagesLoaded(msgs)
      setSwitchingId(null)
      setTimeout(() => window.scrollTo(0, document.body.scrollHeight), 50)
      return
    }

    try {
      const data = await openSession(session.file)
      onMessagesLoaded(data.messages || [])
      setPoolStatus(prev => ({ ...prev, [session.file]: data.status }))
    } catch (err: any) {
      setError(err.message)
    }
    setSwitchingId(null)
  }, [poolStatus, onMessagesLoaded, setPoolStatus, setError])

  // 新建会话
  const handleNewSession = useCallback(async () => {
    setCreating(true)
    setError(null)
    try {
      const data = await create()
      onMessagesLoaded(data.messages || [])
      setPoolStatus(prev => ({ ...prev, [data.sessionFile]: data.status }))
    } catch (err: any) { setError(err.message) }
    finally { setCreating(false) }
  }, [create, onMessagesLoaded, setPoolStatus, setError])

  // 删除会话
  const handleDelete = useCallback(async (sessionFile: string) => {
    setConfirmDelete(null)
    await remove(sessionFile)
    if (activeId === sessionFile) clearMessages()
  }, [remove, activeId, clearMessages])

  // 关闭会话
  const handleClose = useCallback(async () => {
    if (!activeId) return
    await actions.handleClose(activeId, clearMessages)
  }, [activeId, actions, clearMessages])

  // 关闭全部
  const handleCloseAll = useCallback(async () => {
    await actions.handleCloseAll(clearMessages)
  }, [actions, clearMessages])

  // 折叠
  const toggleGroup = useCallback((dir: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(dir)) next.delete(dir); else next.add(dir)
      return next
    })
  }, [])

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
    refresh()
  }, [activeId, refresh])

  // 发消息
  const handleSend = useCallback(() => {
    sendMessage(input, activeId, async () => {
      // SSE 正常结束后刷新完整消息
      if (activeId) {
        try {
          const msgs = await fetchSessionMessages(activeId)
          replaceMessages(msgs)
        } catch {}
      }
    })
    setInput('')
  }, [input, activeId, sendMessage, replaceMessages])

  // 标题
  const title = activeSession?.title
    ? (activeSession.title.length > 9 ? activeSession.title.slice(0, 8) + '...' : activeSession.title)
    : ''

  if (loading) return (
    <div className="h-dvh bg-zinc-50 flex items-center justify-center">
      <div className="text-zinc-400 animate-pulse">加载中...</div>
    </div>
  )

  return (
    <div className="h-dvh bg-white text-zinc-800 flex flex-col overflow-hidden">
      {/* 确认删除 */}
      {confirmDelete && (
        <ConfirmDialog
          title="删除会话"
          message="确定要删除这个会话吗？删除后无法恢复。"
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* 新建遮罩 */}
      {creating && (
        <div className="fixed inset-0 z-[100] bg-white/80 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-sky-200 border-t-sky-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-zinc-500 text-sm">正在新建会话...</p>
          </div>
        </div>
      )}

      {/* 移动端顶部导航 */}
      <header className="md:hidden flex items-center gap-2 px-4 py-3 border-b border-zinc-200 bg-white flex-shrink-0 z-30">
        <Button variant="ghost" size="icon-sm" onClick={() => setSidebarOpen(!sidebarOpen)}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </Button>
        <div className="flex-1 flex items-center gap-1.5 min-w-0">
          {activeSession && (
            <>
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                streaming ? 'animate-pulse bg-emerald-400'
                : activeStatus === 'starting' ? 'animate-pulse bg-amber-400'
                : activeStatus === 'ready' ? 'bg-emerald-500'
                : 'bg-zinc-300'
              }`} />
              <span className="text-sm font-medium text-zinc-700 truncate">
                {activeStatus === 'starting' ? '启动中...' : title}
              </span>
              {title && (
                <button
                  onClick={() => {
                    const name = window.prompt('修改标题', title)
                    if (name && name.trim() && name.trim() !== title) handleRename(name.trim())
                  }}
                  className="text-zinc-300 hover:text-zinc-500 transition-colors flex-shrink-0"
                  title="修改标题"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}
            </>
          )}
          {!activeSession && (
            <span className="text-sm text-zinc-400">pi-web</span>
          )}
        </div>
        {activeSession && (
          <Button variant="ghost" size="icon-sm" onClick={handleClose} className="text-red-400 hover:text-red-600 hover:bg-red-50">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        )}
      </header>

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
        />

        <main className="flex-1 flex flex-col min-w-0">
          {activeId ? (
            <ChatArea
              activeStatus={activeStatus}
              title={title}
              messages={chatMessages}
              streaming={streaming}
              error={error}
              input={input}
              onInputChange={setInput}
              onSend={handleSend}
              onStop={stopGeneration}
              onClose={handleClose}
              onRename={handleRename}
            />
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

export default App
