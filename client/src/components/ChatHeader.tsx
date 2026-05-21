import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import type { PoolStatus } from '../lib/api'

export function ChatHeader({
  status,
  title,
  onClose,
  streaming,
  onRename,
}: {
  status?: PoolStatus
  title: string
  onClose: () => void
  streaming?: boolean
  onRename?: (newName: string) => void
}) {
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

  return (
    <div className="hidden md:flex items-center gap-2 px-5 py-3 border-b border-zinc-200 bg-white flex-shrink-0">
      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotColor}`} />
      {editing ? (
        <input
          ref={inputRef}
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={submitEdit}
          onKeyDown={e => { if (e.key === 'Enter') submitEdit(); if (e.key === 'Escape') setEditing(false) }}
          className="flex-1 text-sm font-medium text-zinc-700 bg-zinc-50 border border-zinc-300 rounded px-1.5 py-0.5 outline-none focus:border-sky-400"
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
      <Button variant="ghost" size="sm" onClick={onClose}>关闭</Button>
    </div>
  )
}
