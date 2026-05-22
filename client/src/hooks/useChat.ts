import { useState, useCallback, useRef, useEffect } from 'react'
import type { HistoryMessage } from '../lib/api'

/**
 * 聊天消息管理（含 SSE 流式接收 + 消息队列）
 */
export function useChat() {
  const [chatMessages, setChatMessages] = useState<HistoryMessage[]>([])
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // 消息队列（ref 方式避免闭包问题）
  const pendingQueueRef = useRef<string[]>([])
  const streamingRef = useRef(false)

  // 同步 streaming 到 ref
  useEffect(() => { streamingRef.current = streaming }, [streaming])

  const clearMessages = useCallback(() => {
    setChatMessages([])
    pendingQueueRef.current = []
  }, [])

  const replaceMessages = useCallback((msgs: HistoryMessage[]) => {
    setChatMessages(msgs)
  }, [])

  /**
   * 追加文本或思考到当前 assistant 消息。
   */
  const appendToAssistant = useCallback((field: 'content' | 'thinking', delta: string) => {
    setChatMessages(prev => {
      const upd = [...prev]
      const last = upd[upd.length - 1]
      if (last?.role === 'assistant') {
        upd[upd.length - 1] = field === 'content'
          ? { ...last, content: last.content + delta }
          : { ...last, thinking: (last.thinking || '') + delta }
      } else {
        const newMsg: HistoryMessage = { role: 'assistant', content: '' }
        if (field === 'thinking') newMsg.thinking = delta
        else newMsg.content = delta
        upd.push(newMsg)
      }
      return upd
    })
  }, [])

  /** 内部发送逻辑（不检查 streaming，直接发） */
  const doSend = useCallback(async (
    text: string,
    activeId: string,
    onComplete?: () => void,
  ) => {
    setError(null)
    streamingRef.current = true
    setStreaming(true)

    // 添加占位 assistant 消息
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

            let textDelta = ''
            let thinkingDelta = ''

            if (event.type === 'text_delta') textDelta = event.text || ''
            else if (event.type === 'thinking_delta') thinkingDelta = event.thinking || ''

            if (event.type === 'message_update' && event.assistantMessageEvent) {
              const sub = event.assistantMessageEvent
              if (sub.type === 'text_delta') textDelta = sub.delta || sub.text || ''
              else if (sub.type === 'thinking_delta') thinkingDelta = sub.delta || sub.thinking || ''
            }

            if (textDelta) appendToAssistant('content', textDelta)
            if (thinkingDelta) appendToAssistant('thinking', thinkingDelta)

            if (event.type === 'tool_execution_start') {
              setChatMessages(prev => [...prev, {
                role: 'toolCall',
                content: JSON.stringify(event.args || ''),
                toolName: event.toolName || 'unknown',
                toolCallId: event.toolCallId || '',
              }])
            }

            if (event.type === 'tool_execution_end') {
              let text = ''
              for (const c of event.result?.content || []) {
                if (c.type === 'text') text += c.text || ''
              }
              setChatMessages(prev => [...prev, {
                role: 'toolResult',
                content: text || '(no output)',
                toolName: event.toolName || 'unknown',
                toolCallId: event.toolCallId || '',
                isError: event.isError || false,
              }])
            }
          } catch {}
        }
      }

      onComplete?.()
    } catch (err: any) {
      if (err.name !== 'AbortError') setError(err.message)
    } finally {
      streamingRef.current = false
      setStreaming(false)
      abortRef.current = null

      // SSE 结束后，检查队列并自动发送下一条
      const next = pendingQueueRef.current.shift()
      if (next) {
        await doSend(next, activeId, onComplete)
      }
    }
  }, [appendToAssistant])

  /** 发送消息：如果正在 streaming 则入队，否则直接发送 */
  const sendMessage = useCallback(async (
    text: string,
    activeId: string | null,
    onComplete?: () => void,
  ) => {
    if (!text.trim() || !activeId) return

    // 先把用户消息加入聊天区
    setChatMessages(prev => [...prev, { role: 'user', content: text }])

    // 如果正在生成，入队等待
    if (streamingRef.current) {
      pendingQueueRef.current = [...pendingQueueRef.current, text]
      return
    }

    // 直接发送
    await doSend(text, activeId, onComplete)
  }, [doSend])

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  return {
    chatMessages, streaming, error, setError,
    sendMessage, clearMessages, replaceMessages, stopGeneration,
  }
}
