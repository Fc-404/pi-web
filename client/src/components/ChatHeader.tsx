import { Button } from '@/components/ui/button'
import type { PoolStatus } from '../lib/api'

export function ChatHeader({
  status,
  title,
  onClose,
}: {
  status?: PoolStatus
  title: string
  onClose: () => void
}) {
  const dotColor = status === 'starting' ? 'animate-pulse bg-amber-400'
    : status === 'ready' ? 'bg-emerald-500'
    : 'bg-zinc-300'

  return (
    <div className="hidden md:flex items-center gap-2 px-5 py-3 border-b border-zinc-200 bg-white flex-shrink-0">
      <div className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
      <span className="text-sm font-medium text-zinc-700 truncate flex-1">
        {status === 'starting' ? '启动中...' : title}
      </span>
      <Button variant="ghost" size="sm" onClick={onClose}>关闭</Button>
    </div>
  )
}
