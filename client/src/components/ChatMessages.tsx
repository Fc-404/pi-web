import { useEffect, useRef, useState } from 'react'
import { MessageBubble } from './MessageBubble'
import { LoadingDots } from './LoadingDots'
import { useChatContext } from '../hooks/useChatContext'

export function ChatMessages() {
  const { messages, streaming, chatError: error, activeStatus, loading, loadingLabel } = useChatContext()
  const scrollRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)

  // 检测用户是否在底部
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const checkBottom = () => {
      const threshold = 30
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
    <div className="flex-1 relative">
      <div ref={scrollRef} className="absolute inset-0 overflow-y-auto overflow-x-hidden px-4 py-4 md:px-6">
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
        )}

        {loading && (
          <LoadingDots label={loadingLabel || '正在加载...'} className="h-full" />
        )}

      {!loading && messages.length === 0 && !streaming && (
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

        {messages.map((msg, i) => (
          <MessageBubble
            key={i}
            msg={msg}
            prevRole={i > 0 ? messages[i - 1].role : undefined}
            nextRole={i < messages.length - 1 ? messages[i + 1].role : undefined}
          />
        ))}

        {streaming && (
          <div className="flex justify-start mb-4">
            <div className="bg-zinc-100 rounded-2xl rounded-bl-md px-4 py-3">
              <LoadingDots size="sm" color="zinc" />
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* 悬浮一键到底按钮 — absolute 相对于外层容器，自动跟随输入框高度 */}
      {!isAtBottom && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 right-6 z-50 w-10 h-10 bg-white border border-zinc-200 shadow-lg rounded-full flex items-center justify-center hover:bg-zinc-100 transition-all active:scale-95"
          title="回到底部"
        >
          <svg className="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14M19 12l-7 7-7-7" />
          </svg>
        </button>
      )}
    </div>
  )
}
