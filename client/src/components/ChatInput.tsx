import { useRef, useEffect, useState, type KeyboardEvent } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { FullscreenInput } from './FullscreenInput'
import { CommandMenu } from './CommandMenu'
import type { Command } from './CommandMenu'
import { useChatContext } from '../hooks/useChatContext'

const thinkingColors: Record<string, string> = {
  off: '#d4d4d8',
  low: '#22d3ee',
  medium: '#60a5fa',
  high: '#818cf8',
  xhigh: '#8b5cf6',
}

export function ChatInput() {
  const {
    input: value,
    onInputChange: onChange,
    onSend,
    onStop,
    streaming,
    thinkingLevel,
    contextUsed,
    contextWindow,
    activeStatus,
    onCommand,
  } = useChatContext()
  const disabled = activeStatus !== 'ready' || streaming
  const placeholder = activeStatus === 'starting' ? '启动中，暂不能发送消息...' : '输入消息...'
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [showCommands, setShowCommands] = useState(false)

  // 命令列表
  const commands: Command[] = [
    {
      id: 'compress',
      label: '压缩上下文',
      description: '移除历史消息，释放上下文空间',
      execute: async () => {
        await onCommand?.('compress')
      },
    },
  ]

  // 输入变化时检测是否需要显示命令菜单
  const handleChange = (val: string) => {
    onChange(val)
    if (val === '/') {
      setShowCommands(true)
    } else if (!val.startsWith('/')) {
      setShowCommands(false)
    }
  }

  // 自动撑高
  useEffect(() => {
    const el = textareaRef.current
    if (!el || fullscreen) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 180) + 'px'
  }, [value, fullscreen])

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (showCommands) return // 命令菜单打开时，Enter 由菜单处理
      onSend()
    }
  }

  if (fullscreen) {
    return (
      <FullscreenInput
        value={value}
        onChange={onChange}
        onSend={onSend}
        onStop={onStop}
        onClose={() => setFullscreen(false)}
        disabled={disabled}
        streaming={streaming}
        thinkingLevel={thinkingLevel}
      />
    )
  }

  const contextPct = contextWindow && contextUsed
    ? Math.min((contextUsed / contextWindow) * 100, 100)
    : 0
  const contextColor = contextPct > 80 ? '#ef4444' : contextPct > 50 ? '#f59e0b' : '#22c55e'

  return (
    <div className="flex-shrink-0 bg-white">
      {/* 上下文进度条 */}
      <div className="h-[2px] bg-zinc-100">
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${contextPct}%`, backgroundColor: contextColor }}
        />
      </div>
      <div className="px-4 py-3 md:px-6">
      <div className="flex gap-2 items-end max-w-4xl mx-auto">
        <div className="flex-1 relative">
          {showCommands && (
            <CommandMenu
              input={value}
              commands={commands}
              onClose={() => setShowCommands(false)}
            />
          )}
          <Textarea
              ref={textareaRef}
              value={value}
              onChange={e => handleChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              rows={1}
              disabled={disabled && !streaming}
              className="min-h-[42px] max-h-[180px] py-[10px] transition-colors duration-300"
              style={{ borderColor: thinkingColors[thinkingLevel || 'high'] || '#d4d4d8' }}
            />
          {value.length > 60 && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setFullscreen(true)}
              className="absolute right-1.5 top-1.5 bg-white/70 backdrop-blur-sm rounded-md"
              title="全屏编辑"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </Button>
          )}
        </div>
        {streaming && !value.trim() ? (
          <Button
            onClick={onStop}
            size="icon"
            className="min-h-[42px] min-w-[42px] bg-red-500 hover:bg-red-600 text-white"
            title="停止生成"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
          </Button>
        ) : (
          <Button
            onClick={onSend}
            disabled={!value.trim()}
            size="icon"
            className="min-h-[42px] min-w-[42px] bg-indigo-500 hover:bg-indigo-600 text-white disabled:bg-zinc-300"
            title={streaming ? '排队发送' : '发送'}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12l7-7 7 7M12 19V5" />
            </svg>
          </Button>
        )}
      </div>
    </div>
    </div>
  )
}
