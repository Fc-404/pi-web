import type { HistoryMessage, PoolStatus } from '../lib/api'
import { ChatHeader } from './ChatHeader'
import { ChatMessages } from './ChatMessages'
import { ChatInput } from './ChatInput'

export function ChatArea({
  activeStatus,
  title,
  messages,
  streaming,
  error,
  input,
  onInputChange,
  onSend,
  onStop,
  onRename,
  loading,
  loadingLabel,
  onOpenSettings,
  thinkingLevel,
  contextUsed,
  contextWindow,
  loadProgress,
}: {
  activeStatus?: PoolStatus
  title: string
  messages: HistoryMessage[]
  streaming: boolean
  error: string | null
  input: string
  onInputChange: (val: string) => void
  onSend: () => void
  onStop: () => void
  onRename?: (newName: string) => void
  loading?: boolean
  loadingLabel?: string | React.ReactNode
  onOpenSettings?: () => void
  thinkingLevel?: string
  contextUsed?: number
  contextWindow?: number
  loadProgress?: { loaded: number; total: number } | null
}) {
  const canSend = activeStatus === 'ready' && !streaming
  const placeholder = activeStatus === 'starting'
    ? '启动中，暂不能发送消息...'
    : '输入消息...'

  return (
    <>
      <ChatHeader status={activeStatus} title={title} streaming={streaming} onRename={onRename} onOpenSettings={onOpenSettings} loading={loading} loadProgress={loadProgress} />
      <ChatMessages
        messages={messages}
        streaming={streaming}
        error={error}
        activeStatus={activeStatus}
        loading={loading}
        loadingLabel={loadingLabel}
      />
      <ChatInput
        value={input}
        onChange={onInputChange}
        onSend={onSend}
        onStop={onStop}
        disabled={!canSend}
        streaming={streaming}
        placeholder={placeholder}
        thinkingLevel={thinkingLevel}
        contextUsed={contextUsed}
        contextWindow={contextWindow}
      />
    </>
  )
}
