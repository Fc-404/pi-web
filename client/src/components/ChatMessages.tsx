import { useEffect, useRef, useState } from 'react'
import type { HistoryMessage, PoolStatus } from '../lib/api'
import { MessageBubble } from './MessageBubble'

export function ChatMessages({
  messages,
  streaming,
  error,
  activeStatus,
}: {
  messages: HistoryMessage[]
  streaming: boolean
  error: string | null
  activeStatus?: PoolStatus
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)

  // 检测用户是否在底部
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const checkBottom = () => {
      const threshold = 80
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold
      setIsAtBottom(atBottom)
    }

    el.addEventListener('scroll', checkBottom, { passive: true })
    checkBottom() // 初始检查
    return () => el.removeEventListener('scroll', checkBottom)
  }, [])

  // 自动滚动到底部（仅当用户在底部时）
  useEffect(() => {
    if (isAtBottom) {
      endRef.current?.scrollIntoView({ behavior: 'auto' })
    }
  }, [messages, isAtBottom])

  // 一键到底
  const scrollToBottom = () => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
    setIsAtBottom(true)
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 md:px-6 relative">
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {messages.length === 0 && !streaming && (
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-zinc-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-zinc-400 text-sm">
              {activeStatus === 'starting' ? '正在启动，请稍候...' : '发送消息开始对话'}
            </p>
          </div>
        </div>
      )}

      {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}

      {streaming && (
        <div className="flex justify-start mb-4">
          <div className="bg-zinc-100 rounded-2xl rounded-bl-md px-4 py-3">
            <span className="inline-flex gap-1">
              <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
          </div>
        </div>
      )}

      {/* 悬浮一键到底按钮 */}
      {!isAtBottom && (
        <button
          onClick={scrollToBottom}
          className="fixed bottom-28 right-6 z-50 w-10 h-10 bg-white border border-zinc-200 shadow-lg rounded-full flex items-center justify-center hover:bg-zinc-100 transition-all active:scale-95"
          title="回到底部"
        >
          <svg className="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14M19 12l-7 7-7-7" />
          </svg>
        </button>
      )}

      <div ref={endRef} />
    </div>
  )
}
