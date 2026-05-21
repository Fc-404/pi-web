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
  onClose,
  onRename,
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
  onClose: () => void
  onRename?: (newName: string) => void
}) {
  const canSend = activeStatus === 'ready' && !streaming
  const placeholder = activeStatus === 'starting'
    ? '启动中，暂不能发送消息...'
    : '输入消息...'

  return (
    <>
      <ChatHeader status={activeStatus} title={title} onClose={onClose} streaming={streaming} onRename={onRename} />
      <ChatMessages
        messages={messages}
        streaming={streaming}
        error={error}
        activeStatus={activeStatus}
      />
      <ChatInput
        value={input}
        onChange={onInputChange}
        onSend={onSend}
        onStop={onStop}
        disabled={!canSend}
        streaming={streaming}
        placeholder={placeholder}
      />
    </>
  )
}
