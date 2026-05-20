import { useState, useEffect } from 'react'
import { fetchSessionStatus, type PoolStatus } from '../lib/api'

/**
 * 轮询进程池状态（每秒）
 */
export function usePoolStatus() {
  const [poolStatus, setPoolStatus] = useState<Record<string, PoolStatus>>({})
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    const poll = async () => {
      try {
        const data = await fetchSessionStatus()
        const map: Record<string, PoolStatus> = {}
        for (const s of data.statuses) map[s.file] = s.status
        setPoolStatus(map)
        setActiveId(data.activeId)
      } catch {}
    }
    poll()
    const timer = setInterval(poll, 1000)
    return () => clearInterval(timer)
  }, [])

  return { poolStatus, activeId, setPoolStatus, setActiveId }
}
