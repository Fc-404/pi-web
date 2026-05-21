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

  /**
   * 追加文本或思考到当前 assistant 消息。
   * 如果最后一条消息不是 assistant，则先新建一条空 assistant 消息。
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

  /** 发送消息，返回 SSE 流并逐步更新聊天内容 */
  const sendMessage = useCallback(async (
    text: string,
    activeId: string | null,
    onComplete?: () => void,
  ) => {
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

            // 文本增量
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

            // 工具调用开始 → 添加 toolCall 消息
            if (event.type === 'tool_execution_start') {
              setChatMessages(prev => [...prev, {
                role: 'toolCall',
                content: JSON.stringify(event.args || ''),
                toolName: event.toolName || 'unknown',
                toolCallId: event.toolCallId || '',
              }])
            }

            // 工具调用结束 → 添加 toolResult 消息
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

      // SSE 正常结束，触发完成回调（刷新完整消息，替换实时拼装的内容）
      onComplete?.()
    } catch (err: any) {
      if (err.name !== 'AbortError') setError(err.message)
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }, [streaming, appendToAssistant])

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  return { chatMessages, streaming, error, setError, sendMessage, clearMessages, replaceMessages, stopGeneration }
}
