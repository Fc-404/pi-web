import { useRef, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'

export function FullscreenInput({
  value,
  onChange,
  onSend,
  onStop,
  onClose,
  disabled,
  streaming,
}: {
  value: string
  onChange: (val: string) => void
  onSend: () => void
  onStop: () => void
  onClose: () => void
  disabled: boolean
  streaming: boolean
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
        className="flex-1 w-full p-5 text-base resize-none outline-none"
        disabled={disabled}
      />
      <div className="p-4 border-t border-zinc-200">
        {streaming ? (
          <Button onClick={onStop} className="w-full py-3 bg-red-500 hover:bg-red-600 text-white">
            停止生成
          </Button>
        ) : (
          <Button onClick={onSend} disabled={disabled || !value.trim()} className="w-full py-3 bg-sky-500 hover:bg-sky-600 text-white">
            发送
          </Button>
        )}
      </div>
    </div>
  )
}
