import { useCallback } from 'react'
import {
  openSession,
  switchSession,
  closeSession,
  closeAllSessions,
  fetchSessionMessages,
  type SessionInfo,
  type PoolStatus,
} from '../lib/api'

/**
 * 会话操作封装
 */
export function useSessionActions(
  poolStatus: Record<string, PoolStatus>,
  onMessagesLoaded: (messages: any[]) => void,
  onStatusUpdate: (file: string, status: PoolStatus) => void,
) {
  /** 点击会话：打开或切换 */
  const handleSessionClick = useCallback(async (
    session: SessionInfo,
    onSwitching: (id: string | null) => void,
    onError: (err: string | null) => void,
  ) => {
    onSwitching(session.id)
    onError(null)

    const currentStatus = poolStatus[session.file]
    if (currentStatus === 'starting' || currentStatus === 'ready') {
      await switchSession(session.file)
      const msgs = await fetchSessionMessages(session.file)
      onMessagesLoaded(msgs)
      onSwitching(null)
      return
    }

    try {
      const data = await openSession(session.file)
      onMessagesLoaded(data.messages || [])
      onStatusUpdate(session.file, data.status)
    } catch (err: any) {
      onError(err.message)
    }
    onSwitching(null)
  }, [poolStatus, onMessagesLoaded, onStatusUpdate])

  /** 关闭会话 */
  const handleClose = useCallback(async (activeId: string | null, onCleared: () => void) => {
    if (!activeId) return
    await closeSession(activeId)
    onCleared()
  }, [])

  /** 关闭全部 */
  const handleCloseAll = useCallback(async (onCleared: () => void) => {
    await closeAllSessions()
    onCleared()
  }, [])

  return { handleSessionClick, handleClose, handleCloseAll }
}
