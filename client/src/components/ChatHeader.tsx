import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useChatContext } from '../hooks/useChatContext'

export function ChatHeader() {
  const {
    activeStatus: status,
    title,
    streaming,
    onRename,
    onOpenSettings,
    loading,
    loadProgress,
    onToggleSidebar,
  } = useChatContext()
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const dotColor = streaming ? 'animate-pulse bg-emerald-400'
    : status === 'starting' ? 'animate-pulse bg-amber-400'
    : status === 'ready' ? 'bg-emerald-500'
    : 'bg-zinc-300'

  const startEdit = () => {
    setEditValue(title)
    setEditing(true)
  }

  const submitEdit = () => {
    const val = editValue.trim()
    if (val && val !== title && onRename) {
      onRename(val)
    }
    setEditing(false)
  }

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const pct = loadProgress ? Math.min((loadProgress.loaded / loadProgress.total) * 100, 100) : 0

  // 标题栏内容（PC 和移动端共享）
  const headerContent = (
    <>
      <Button variant="ghost" size="icon-sm" onClick={onToggleSidebar} className="md:hidden flex-shrink-0">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </Button>
      <div className={`w-2 h-2 md:w-2.5 md:h-2.5 rounded-full flex-shrink-0 ${dotColor}`} />
      {editing ? (
        <input
          ref={inputRef}
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={submitEdit}
          onKeyDown={e => { if (e.key === 'Enter') submitEdit(); if (e.key === 'Escape') setEditing(false) }}
          className="flex-1 text-sm font-medium text-zinc-700 bg-zinc-50 border border-zinc-300 rounded px-1.5 py-0.5 outline-none focus:border-indigo-400"
        />
      ) : (
        <>
          <span className="text-sm font-medium text-zinc-700 truncate flex-1">
            {status === 'starting' ? '启动中...' : title}
          </span>
          {title && onRename && (
            <button
              onClick={startEdit}
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
      {onOpenSettings && (
        <Button variant="ghost" size="icon-sm" onClick={onOpenSettings} className="flex-shrink-0" title="设置">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </Button>
      )}
    </>
  )

  const done = loadProgress && loadProgress.loaded >= loadProgress.total
  const progressBar = loading ? (
    <div className="h-px bg-zinc-100">
      <div
        className={`h-full ${done ? 'bg-emerald-400' : 'bg-indigo-400'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  ) : (
    <div className="h-px bg-zinc-200" />
  )

  return (
    <>
      {/* PC 端 */}
      <div className="hidden md:flex flex-col flex-shrink-0">
        <div className="flex items-center gap-2 px-5 py-3 bg-white">
          {headerContent}
        </div>
        {progressBar}
      </div>
      {/* 移动端 */}
      <div className="flex md:hidden flex-col flex-shrink-0 bg-white">
        <div className="flex items-center gap-2 px-4 py-3">
          {headerContent}
        </div>
        {progressBar}
      </div>
    </>
  )
}
