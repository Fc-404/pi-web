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
  onClose,
}: {
  activeStatus?: PoolStatus
  title: string
  messages: HistoryMessage[]
  streaming: boolean
  error: string | null
  input: string
  onInputChange: (val: string) => void
  onSend: () => void
  onClose: () => void
}) {
  const canSend = activeStatus === 'ready' && !streaming
  const placeholder = activeStatus === 'starting'
    ? '启动中，暂不能发送消息...'
    : '输入消息...'

  return (
    <>
      <ChatHeader status={activeStatus} title={title} onClose={onClose} />
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
        disabled={!canSend}
        placeholder={placeholder}
      />
    </>
  )
}
