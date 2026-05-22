import { type SessionGroup, type SessionInfo, type PoolStatus } from '../lib/api'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'

function formatTime(ts: string) {
  try {
    const d = new Date(ts)
    const now = new Date()
    return now.getTime() - d.getTime() < 86400000
      ? d.toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return ts }
}

function displayTitle(title: string): string {
  if (!title) return '(空会话)'
  return title.length > 9 ? title.slice(0, 8) + '...' : title
}

/** 侧栏内部内容（桌面端和移动端共享） */
function SidebarContent({
  groups, collapsedGroups, poolStatus, activeId, switchingId, totalSessions,
  onToggleGroup, onSessionClick, onDelete, onNew, onCloseAll, onCloseSidebar, onClose,
}: {
  groups: SessionGroup[]
  collapsedGroups: Set<string>
  poolStatus: Record<string, PoolStatus>
  activeId: string | null
  switchingId: string | null
  totalSessions: number
  onToggleGroup: (dir: string) => void
  onSessionClick: (session: SessionInfo) => void
  onDelete: (file: string) => void
  onNew: () => void
  onCloseAll: () => void
  onCloseSidebar: () => void
  onClose: (sessionFile: string) => void
}) {
  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 flex-shrink-0">
        <h1 className="text-base font-semibold text-zinc-800">PI WEB</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400">{totalSessions}</span>
          <Button variant="ghost" size="icon-sm" onClick={onCloseSidebar} className="md:hidden">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>
      </div>

      {/* 会话列表 */}
      <ScrollArea className="flex-1 min-h-0 p-3">
      <nav className="space-y-2">
        {groups.map(group => {
          const isCollapsed = collapsedGroups.has(group.dir)
          return (
            <div key={group.dir}>
              <button
                onClick={() => onToggleGroup(group.dir)}
                className="w-full flex items-center gap-2 px-1 py-1.5 rounded-lg hover:bg-zinc-50 transition-colors"
              >
                <svg className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider truncate">{group.cwd}</span>
                <span className="text-[10px] text-zinc-300 ml-auto">{group.sessions.length}</span>
              </button>
              {!isCollapsed && (
                <div className="space-y-0.5 pl-4 mt-0.5">
                  {group.sessions.map(session => {
                    const st = poolStatus[session.file]
                    const isStarting = st === 'starting'
                    const isReady = st === 'ready'
                    const isActive = activeId === session.file
                    const isSwitching = switchingId === session.id

                    const dotColor = isSwitching || isStarting ? 'animate-pulse bg-amber-400'
                      : isReady ? 'bg-emerald-500'
                      : 'bg-zinc-200'

                    const badge = isSwitching || isStarting ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 whitespace-nowrap">启动中</span>
                    ) : isReady ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 whitespace-nowrap">进行中</span>
                    ) : null

                    return (
                      <div key={session.id} className="group/item">
                        <button
                          onClick={() => onSessionClick(session)}
                          className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors
                            ${isActive ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-zinc-50 border border-transparent'}`}>
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium truncate ${isActive ? 'text-indigo-800' : 'text-zinc-800'}`}>
                                {displayTitle(session.title)}
                              </span>
                              {badge}
                            </div>
                            <div className="text-xs text-zinc-400 mt-0.5">{formatTime(session.startedAt)}</div>
                          </div>
                          {(isStarting || isReady) && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={(e) => { e.stopPropagation(); onClose(session.file) }}
                              className="md:opacity-0 md:group-hover/item:opacity-100 hover:bg-red-50 flex-shrink-0"
                              title="终止"
                            >
                              <svg className="w-4 h-4 text-zinc-400 hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={(e) => { e.stopPropagation(); onDelete(session.file) }}
                            className="md:opacity-0 md:group-hover/item:opacity-100 hover:bg-red-50 flex-shrink-0 ml-0.5"
                            title="删除"
                          >
                            <svg className="w-4 h-4 text-zinc-400 hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </Button>
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>
      </ScrollArea>

      {/* 底部按钮 */}
      <div className="p-3 border-t border-zinc-100 flex gap-2">
        <Button onClick={onNew} variant="secondary" className="flex-1">
          + 新建
        </Button>
        <Button onClick={onCloseAll} variant="ghost" className="text-zinc-400 hover:text-red-500 whitespace-nowrap">
          关闭全部
        </Button>
      </div>
    </div>
  )
}

export function Sidebar({
  groups,
  collapsedGroups,
  poolStatus,
  activeId,
  switchingId,
  totalSessions,
  sidebarOpen,
  onToggleGroup,
  onSessionClick,
  onDelete,
  onNew,
  onCloseAll,
  onCloseSidebar,
  onClose,
}: {
  groups: SessionGroup[]
  collapsedGroups: Set<string>
  poolStatus: Record<string, PoolStatus>
  activeId: string | null
  switchingId: string | null
  totalSessions: number
  sidebarOpen: boolean
  onToggleGroup: (dir: string) => void
  onSessionClick: (session: SessionInfo) => void
  onDelete: (file: string) => void
  onNew: () => void
  onCloseAll: () => void
  onCloseSidebar: () => void
  onClose: (sessionFile: string) => void
}) {
  const sidebarProps = {
    groups, collapsedGroups, poolStatus, activeId, switchingId, totalSessions,
    onToggleGroup, onSessionClick, onDelete, onNew, onCloseAll, onCloseSidebar, onClose,
  }

  return (
    <>
      {/* 移动端 Sheet */}
      <div className="md:hidden">
        <Sheet open={sidebarOpen} onOpenChange={(open) => { if (!open) onCloseSidebar() }}>
          <SheetContent side="left" className="w-72 p-0" showCloseButton={false}>
            <SidebarContent {...sidebarProps} />
          </SheetContent>
        </Sheet>
      </div>

      {/* 桌面端静态侧栏 */}
      <aside className="hidden md:flex md:flex-col md:flex-shrink-0 md:w-72 md:border-r md:border-zinc-200 md:bg-white">
        <SidebarContent {...sidebarProps} />
      </aside>
    </>
  )
}
