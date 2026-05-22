import { createContext, useContext, type ReactNode } from 'react'
import type { HistoryMessage, PoolStatus } from '../lib/api'

export interface ChatContextValue {
  messages: HistoryMessage[]
  streaming: boolean
  chatError: string | null
  activeStatus?: PoolStatus
  loading: boolean
  loadProgress: { loaded: number; total: number } | null
  thinkingLevel: string
  contextUsed: number
  contextWindow: number
  input: string
  title: string
  onInputChange: (val: string) => void
  onSend: () => void
  onStop: () => void
  onRename?: (newName: string) => void
  onOpenSettings?: () => void
  onToggleSidebar?: () => void
  loadingLabel?: ReactNode
}

const ChatContext = createContext<ChatContextValue>(null!)

export function useChatContext() {
  return useContext(ChatContext)
}

export function ChatContextProvider({
  value,
  children,
}: {
  value: ChatContextValue
  children: ReactNode
}) {
  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  )
}
