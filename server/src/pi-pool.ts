import { RpcClient, type AgentEvent } from './rpc-client.js'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { getMessages, remove, type HistoryMessage } from './session-store.js'

const SESSION_DIR = join(homedir(), '.pi', 'agent', 'sessions')

type SessionStatus = 'stopped' | 'starting' | 'ready'

interface SessionEntry {
  client: RpcClient
  status: SessionStatus
  file: string          // 相对路径（组/文件）
  fullPath: string      // 绝对路径
}

type PoolEventCallback = (event: AgentEvent & { sessionFile: string }) => void

/**
 * 多进程池：每个会话一个独立的 pi RPC 进程
 */
export class PiPool {
  private pool = new Map<string, SessionEntry>()
  private _activeId: string | null = null
  private eventListeners: Set<PoolEventCallback> = new Set()

  get activeId() { return this._activeId }

  /**
   * 获取所有会话的状态
   */
  getAllStatus(): Array<{ file: string; status: SessionStatus }> {
    const result: Array<{ file: string; status: SessionStatus }> = []
    for (const [file, entry] of this.pool) {
      result.push({ file, status: entry.status })
    }
    return result
  }

  /**
   * 获取指定会话的状态
   */
  getStatus(sessionFile: string): SessionStatus {
    return this.pool.get(sessionFile)?.status || 'stopped'
  }

  /**
   * 订阅事件（来自当前活跃会话）
   */
  onEvent(cb: PoolEventCallback): () => void {
    this.eventListeners.add(cb)
    return () => this.eventListeners.delete(cb)
  }

  /** 广播事件（携带会话标识） */
  private broadcast(event: AgentEvent, sessionFile: string) {
    const enriched = { ...event, sessionFile }
    this.eventListeners.forEach(cb => cb(enriched))
  }

  /**
   * 打开/启动一个会话
   * - 如果未启动，创建 RPC 进程并后台就绪
   * - 立即返回历史消息（让用户先看）
   */
  async open(sessionFile: string): Promise<{
    messages: HistoryMessage[]
    status: SessionStatus
  }> {
    const existing = this.pool.get(sessionFile)
    if (existing) {
      // 已存在，直接返回当前状态和历史
      return {
        messages: getMessages(sessionFile),
        status: existing.status,
      }
    }

    const fullPath = sessionFile.startsWith('/')
      ? sessionFile
      : join(SESSION_DIR, sessionFile)

    // 创建新 RPC 客户端
    const client = new RpcClient()
    const entry: SessionEntry = { client, status: 'starting', file: sessionFile, fullPath }
    this.pool.set(sessionFile, entry)

    // 订阅这个客户端的事件（仅活跃会话才向外广播）
    client.onEvent((event) => {
      // 只有当这个会话是活跃会话时，才向外广播
      if (this._activeId === sessionFile) {
        this.broadcast(event, sessionFile)
      }
    })

    // 先返回历史消息，后台启动
    const messages = getMessages(sessionFile)

    // 后台异步启动
    this.startClient(client, fullPath, sessionFile)

    return { messages, status: 'starting' }
  }

  /** 后台启动 RPC 进程 */
  private async startClient(client: RpcClient, fullPath: string, sessionFile: string): Promise<void> {
    try {
      client.start(fullPath)

      // 等待 RPC 就绪
      for (let i = 0; i < 75; i++) {
        await new Promise((r) => setTimeout(r, 200))
        if (!client.running) continue
        try {
          await client.getState()
          // 就绪！
          const entry = this.pool.get(sessionFile)
          if (entry) entry.status = 'ready'
          // 如果启动后就是活跃会话，广播状态变化
          if (this._activeId === sessionFile) {
            this.broadcast({ type: 'session_ready' } as any, sessionFile)
          }
          return
        } catch { /* 还没就绪 */ }
      }
      // 超时
      console.warn(`[PiPool] Session ${sessionFile} startup timed out`)
      const entry = this.pool.get(sessionFile)
      if (entry) this.pool.delete(sessionFile)
    } catch (err) {
      console.error(`[PiPool] Session ${sessionFile} startup failed:`, err)
      this.pool.delete(sessionFile)
    }
  }

  /**
   * 切换到指定会话（设为活跃会话）
   */
  switchTo(sessionFile: string): void {
    this._activeId = sessionFile
  }

  /**
   * 关闭指定会话（停进程，不移除状态记录）
   */
  async close(sessionFile: string): Promise<void> {
    const entry = this.pool.get(sessionFile)
    if (!entry) return

    await entry.client.stop()
    this.pool.delete(sessionFile)

    if (this._activeId === sessionFile) {
      this._activeId = null
    }
  }

  /**
   * 删除会话（停进程 + 删文件）
   */
  async delete(sessionFile: string): Promise<void> {
    const entry = this.pool.get(sessionFile)
    if (entry) {
      await entry.client.stop()
      this.pool.delete(sessionFile)
    }

    // 删除文件（委托给 sessions.ts）
    remove(sessionFile)

    if (this._activeId === sessionFile) {
      this._activeId = null
    }
  }

  /**
   * 关闭全部会话
   */
  async closeAll(): Promise<void> {
    for (const [file, entry] of this.pool) {
      await entry.client.stop()
    }
    this.pool.clear()
    this._activeId = null
  }

  /**
   * 给当前活跃会话发送消息
   */
  async prompt(message: string): Promise<void> {
    if (!this._activeId) throw new Error('No active session')
    const entry = this.pool.get(this._activeId)
    if (!entry) throw new Error('Active session not found in pool')
    if (entry.status !== 'ready') throw new Error('Session is not ready yet')
    await entry.client.prompt(message)
  }

  /**
   * 获取活跃会话的消息
   */
  getActiveMessages(): HistoryMessage[] {
    if (!this._activeId) return []
    return getMessages(this._activeId)
  }

  /**
   * 获取指定会话的运行时状态（模型、思考级别等）
   */
  async getSessionState(sessionFile: string): Promise<Record<string, unknown>> {
    const entry = this.pool.get(sessionFile)
    if (!entry || !entry.client.running) {
      return { status: 'stopped', message: 'Session is not running' }
    }
    try {
      return await entry.client.getState()
    } catch (err: any) {
      throw new Error(`Failed to get session state: ${err.message}`)
    }
  }

  async setModel(sessionFile: string, provider: string, modelId: string): Promise<void> {
    const entry = this.pool.get(sessionFile)
    if (!entry || !entry.client.running) {
      throw new Error('Session is not running')
    }
    await entry.client.setModel(provider, modelId)
  }

  async setThinkingLevel(sessionFile: string, level: string): Promise<void> {
    const entry = this.pool.get(sessionFile)
    if (!entry || !entry.client.running) {
      throw new Error('Session is not running')
    }
    await entry.client.setThinkingLevel(level)
  }
}

// 全局单例
export const piPool = new PiPool()
