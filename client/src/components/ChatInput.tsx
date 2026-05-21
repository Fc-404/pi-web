import { useRef, useEffect, useState, type KeyboardEvent } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { FullscreenInput } from './FullscreenInput'

export function ChatInput({
  value,
  onChange,
  onSend,
  onStop,
  disabled,
  streaming,
  placeholder,
}: {
  value: string
  onChange: (val: string) => void
  onSend: () => void
  onStop: () => void
  disabled: boolean
  streaming: boolean
  placeholder: string
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [fullscreen, setFullscreen] = useState(false)

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
      />
    )
  }

  return (
    <div className="flex-shrink-0 border-t border-zinc-200 bg-white px-4 py-3 md:px-6">
      <div className="flex gap-2 items-end max-w-4xl mx-auto">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={e => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            disabled={disabled}
            className="min-h-[42px] max-h-[180px] py-[10px]"
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
        {streaming ? (
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
            disabled={disabled || !value.trim()}
            size="icon"
            className="min-h-[42px] min-w-[42px] bg-sky-500 hover:bg-sky-600 text-white"
            title="发送"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12l7-7 7 7M12 19V5" />
            </svg>
          </Button>
        )}
      </div>
    </div>
  )
}
