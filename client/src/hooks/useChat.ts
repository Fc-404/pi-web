import { useState, useCallback, useRef } from 'react'
import type { HistoryMessage } from '../lib/api'

/**
 * 聊天消息管理（含 SSE 流式接收）
 */
export function useChat() {
  const [chatMessages, setChatMessages] = useState<HistoryMessage[]>([])
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const clearMessages = useCallback(() => setChatMessages([]), [])

  const replaceMessages = useCallback((msgs: HistoryMessage[]) => {
    setChatMessages(msgs)
  }, [])

  /** 发送消息，返回 SSE 流并逐步更新聊天内容 */
  const sendMessage = useCallback(async (text: string, activeId: string | null) => {
    if (!text.trim() || streaming || !activeId) return

    setError(null)
    setStreaming(true)

    // 添加用户消息 + 占位 assistant 消息
    setChatMessages(prev => [...prev, { role: 'user', content: text }])
    setChatMessages(prev => [...prev, { role: 'assistant', content: '' }])

    try {
      const controller = new AbortController()
      abortRef.current = controller

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
        signal: controller.signal,
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('event: ') || !line.startsWith('data: ')) continue
          const dataStr = line.slice(6)
          if (!dataStr) continue
          try {
            const event = JSON.parse(dataStr)

            // 从事件中提取文本增量
            let textDelta = ''
            let thinkingDelta = ''

            if (event.type === 'text_delta') textDelta = event.text || ''
            else if (event.type === 'thinking_delta') thinkingDelta = event.thinking || ''

            if (event.type === 'message_update' && event.assistantMessageEvent) {
              const sub = event.assistantMessageEvent
              if (sub.type === 'text_delta') textDelta = sub.delta || sub.text || ''
              else if (sub.type === 'thinking_delta') thinkingDelta = sub.delta || sub.thinking || ''
            }

            if (textDelta) {
              setChatMessages(prev => {
                const upd = [...prev]
                const last = upd[upd.length - 1]
                if (last?.role === 'assistant') upd[upd.length - 1] = { ...last, content: last.content + textDelta }
                return upd
              })
            }
            if (thinkingDelta) {
              setChatMessages(prev => {
                const upd = [...prev]
                const last = upd[upd.length - 1]
                if (last?.role === 'assistant') upd[upd.length - 1] = { ...last, thinking: (last.thinking || '') + thinkingDelta }
                return upd
              })
            }
          } catch {}
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') setError(err.message)
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }, [streaming])

  return { chatMessages, streaming, error, setError, sendMessage, clearMessages, replaceMessages }
}
