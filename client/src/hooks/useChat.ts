import { useState, useCallback, useRef, useEffect } from 'react'
import type { HistoryMessage } from '../lib/api'
import { readSSEEvents } from '../lib/sse-reader'

/**
 * 聊天消息管理（含 SSE 流式接收 + 消息队列）
 *
 * SSE 字节流解析委托给 readSSEEvents，本 hook 专注 React 状态协调。
 */
export function useChat() {
  const [chatMessages, setChatMessages] = useState<HistoryMessage[]>([])
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // 消息队列（ref 避免闭包问题）
  const pendingQueueRef = useRef<string[]>([])
  const streamingRef = useRef(false)

  useEffect(() => { streamingRef.current = streaming }, [streaming])

  const clearMessages = useCallback(() => {
    setChatMessages([])
    pendingQueueRef.current = []
  }, [])

  const replaceMessages = useCallback((msgs: HistoryMessage[]) => {
    setChatMessages(msgs)
  }, [])

  /**
   * 追加文本或思考到当前 assistant 消息
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

  /**
   * 处理单个 SSE 事件：提取增量 + 处理工具事件
   */
  const processEvent = useCallback((event: Record<string, unknown>) => {
    // 提取文本/思考增量
    let textDelta = ''
    let thinkingDelta = ''

    if (event.type === 'text_delta') textDelta = (event.text as string) || ''
    else if (event.type === 'thinking_delta') thinkingDelta = (event.thinking as string) || ''

    // message_update 可能包裹子事件
    if (event.type === 'message_update' && event.assistantMessageEvent) {
      const sub = event.assistantMessageEvent as Record<string, unknown>
      if (sub.type === 'text_delta') textDelta = (sub.delta || sub.text || '') as string
      else if (sub.type === 'thinking_delta') thinkingDelta = (sub.delta || sub.thinking || '') as string
    }

    if (textDelta) appendToAssistant('content', textDelta)
    if (thinkingDelta) appendToAssistant('thinking', thinkingDelta)

    // 工具事件
    if (event.type === 'tool_execution_start') {
      setChatMessages(prev => [...prev, {
        role: 'toolCall',
        content: JSON.stringify((event as any).args || ''),
        toolName: (event as any).toolName || 'unknown',
        toolCallId: (event as any).toolCallId || '',
      }])
    }

    if (event.type === 'tool_execution_end') {
      let text = ''
      const result = (event as any).result
      for (const c of result?.content || []) {
        if (c.type === 'text') text += c.text || ''
      }
      setChatMessages(prev => [...prev, {
        role: 'toolResult',
        content: text || '(no output)',
        toolName: (event as any).toolName || 'unknown',
        toolCallId: (event as any).toolCallId || '',
        isError: (event as any).isError || false,
      }])
    }
  }, [appendToAssistant])

  /**
   * 内部发送逻辑：只加 assistant 占位，不处理用户消息
   * （用户消息由 sendMessage 添加）
   */
  const doSend = useCallback(async (
    text: string,
    activeId: string,
    onComplete?: () => void,
  ) => {
    setError(null)
    streamingRef.current = true
    setStreaming(true)

    // 添加 assistant 占位消息
    setChatMessages(prev => [...prev, { role: 'assistant', content: '' }])

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
        signal: controller.signal,
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Chat request failed')
      }

      // 使用 readSSEEvents 逐事件解析
      for await (const event of readSSEEvents(res.body!.getReader())) {
        processEvent(event)
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
  }, [processEvent])

  /**
   * 发送消息：先添加用户消息到列表，如果正在 streaming 则入队等待
   */
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
