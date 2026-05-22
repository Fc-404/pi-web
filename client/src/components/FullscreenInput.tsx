import { useRef, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'

const thinkingBorderColors: Record<string, string> = {
  off: '#d4d4d8',
  low: '#22d3ee',
  medium: '#60a5fa',
  high: '#818cf8',
  xhigh: '#8b5cf6',
}

export function FullscreenInput({
  value,
  onChange,
  onSend,
  onStop,
  onClose,
  disabled,
  streaming,
  thinkingLevel,
}: {
  value: string
  onChange: (val: string) => void
  onSend: () => void
  onStop: () => void
  onClose: () => void
  disabled: boolean
  streaming: boolean
  thinkingLevel?: string
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  return (
    <div className="fixed inset-0 z-[150] bg-white flex flex-col" style={{ height: '100dvh' }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200">
        <span className="text-sm font-medium text-zinc-700">输入消息</span>
        <Button variant="ghost" size="sm" onClick={onClose}>完成</Button>
      </div>
      <textarea
        ref={textareaRef}
        autoFocus
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="输入消息..."
        className="flex-1 w-full p-5 text-base resize-none outline-none transition-colors duration-300 border"
        style={{ borderColor: thinkingBorderColors[thinkingLevel || 'high'] || '#d4d4d8' }}
        disabled={disabled && !streaming}
      />
      <div className="p-4 border-t border-zinc-200">
        {streaming && !value.trim() ? (
          <Button onClick={onStop} className="w-full py-3 bg-red-500 hover:bg-red-600 text-white">
            停止生成
          </Button>
        ) : (
          <Button onClick={onSend} disabled={!value.trim()} className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white disabled:bg-zinc-300">
            {streaming ? '排队发送' : '发送'}
          </Button>
        )}
      </div>
    </div>
  )
}
