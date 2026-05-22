/**
 * 主布局：侧边栏 + 主内容区（支持聊天/配置模式切换）
 *
 * 业务逻辑委托给 useChatActions，本文件只做 UI 组装。
 */
import { Button } from '@/components/ui/button'
import { Sidebar } from './Sidebar'
import { ChatHeader } from './ChatHeader'
import { ChatMessages } from './ChatMessages'
import { ChatInput } from './ChatInput'
import { ChatContextProvider } from '../hooks/useChatContext'
import { ConfigContent } from './ConfigContent'
import { ConfirmDialog } from './ConfirmDialog'
import { useChatActions } from '../hooks/useChatActions'
import { LoadingDots } from './LoadingDots'
import { SettingsPanel } from './SettingsPanel'

export function MainLayout() {
  const a = useChatActions()

  if (a.sessionsLoading) return (
    <div className="h-dvh bg-zinc-50 flex items-center justify-center">
      <div className="text-zinc-400 animate-pulse">加载中...</div>
    </div>
  )

  return (
    <div className="h-dvh bg-white text-zinc-800 flex flex-col overflow-hidden">
      {a.confirmDelete && (
        <ConfirmDialog
          title="删除会话"
          message="确定要删除这个会话吗？删除后无法恢复。"
          onConfirm={() => a.handleDelete(a.confirmDelete!)}
          onCancel={() => a.setConfirmDelete(null)}
        />
      )}

      <SettingsPanel
        open={a.settingsOpen}
        onClose={a.handleCloseSettings}
        onApply={a.handleApplySettings}
        activeId={a.activeId}
      />

      {a.creating && (
        <div className="fixed inset-0 z-[100] bg-white/80 backdrop-blur-sm flex items-center justify-center">
          <LoadingDots label="正在新建会话..." />
        </div>
      )}

      {/* 移动端顶部导航 */}
      {!a.activeSession && a.mode === 'chat' && (
        <header className="flex md:hidden items-center gap-2 px-4 py-3 border-b border-zinc-200 bg-white flex-shrink-0">
          <Button variant="ghost" size="icon-sm" onClick={() => a.setSidebarOpen(v => !v)}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </Button>
          <span className="text-sm text-zinc-400">pi-web</span>
        </header>
      )}

      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar
          groups={a.groups}
          collapsedGroups={a.collapsedGroups}
          poolStatus={a.poolStatus}
          activeId={a.activeId}
          switchingId={a.switchingId}
          totalSessions={a.totalSessions}
          sidebarOpen={a.sidebarOpen}
          isConfig={a.mode === 'config'}
          onToggleGroup={a.toggleGroup}
          onSessionClick={(session) => { a.setMode('chat'); a.handleSessionClick(session) }}
          onDelete={a.setConfirmDelete}
          onNew={a.handleNewSession}
          onCloseAll={a.handleCloseAll}
          onCloseSidebar={() => a.setSidebarOpen(false)}
          onClose={a.handleCloseSession}
          onToggleConfig={() => a.setMode(m => m === 'chat' ? 'config' : 'chat')}
        />

        <main className="flex-1 flex flex-col min-w-0">
          {a.mode === 'config' ? (
            <ConfigContent onToggleSidebar={() => a.setSidebarOpen(v => !v)} />
          ) : a.activeId ? (
            <ChatContextProvider value={{
              messages: a.chatMessages, streaming: a.streaming, chatError: a.error,
              activeStatus: a.activeStatus, loading: a.isLoading, loadProgress: a.loadProgress,
              thinkingLevel: a.thinkingLevel, contextUsed: a.contextUsed, contextWindow: a.contextWindow,
              input: a.input, title: a.title,
              onInputChange: a.setInput, onSend: a.handleSend,
              onStop: a.stopGeneration, onRename: a.handleRename,
              onOpenSettings: a.handleOpenSettings,
              onToggleSidebar: () => a.setSidebarOpen(v => !v),
              loadingLabel: a.isLoading ? (
                a.loadProgress
                  ? `正在加载 ${(a.loadProgress.loaded / 1024).toFixed(0)}KB / ${(a.loadProgress.total / 1024).toFixed(0)}KB`
                  : '正在加载...'
              ) : undefined,
            }}>
              <ChatHeader />
              <ChatMessages />
              <ChatInput />
            </ChatContextProvider>
          ) : (
            <div className="flex flex-1 items-center justify-center">
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
