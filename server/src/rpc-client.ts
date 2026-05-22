import { spawn, type ChildProcess } from 'node:child_process'
import { createInterface } from 'node:readline'

// ===== 类型定义 =====

export type RpcCommand =
  | { type: 'prompt'; message: string }
  | { type: 'steer'; message: string }
  | { type: 'follow_up'; message: string }
  | { type: 'abort' }
  | { type: 'new_session'; parentSession?: string }
  | { type: 'get_state' }
  | { type: 'get_messages' }
  | { type: 'switch_session'; sessionPath: string }
  | { type: 'set_model'; provider: string; modelId: string }
  | { type: 'set_thinking_level'; level: string }
  | { type: 'compact' }

export interface RpcResponseBase {
  id?: string
  type: string
  command?: string
  success?: boolean
  error?: string
  data?: unknown
}

export interface AgentEvent {
  type: string
  [key: string]: unknown
}

// ===== 等待响应的命令条目 =====
interface PendingCommand {
  commandType: string
  resolve: (res: RpcResponseBase) => void
  reject: (err: Error) => void
  timer: ReturnType<typeof setTimeout>
}

// ===== RPC 客户端 =====

export class RpcClient {
  private proc: ChildProcess | null = null
  private rl: ReturnType<typeof createInterface> | null = null
  private eventCallbacks: Array<(event: AgentEvent) => void> = []
  /** 按顺序排队等待响应的命令 */
  private pendingQueue: PendingCommand[] = []
  private _running = false

  get running() { return this._running }

  start(sessionFile?: string): void {
    if (this._running) return

    const args = ['--mode', 'rpc']
    if (sessionFile) args.push('--session', sessionFile)

    const proc = spawn('pi', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    })
    this.proc = proc
    this._running = true

    this.rl = createInterface({ input: proc.stdout! })
    this.rl.on('line', (line) => {
      line = line.trim()
      if (!line) return
      try {
        const msg = JSON.parse(line)

        // 如果是命令响应，按顺序匹配 pending 队列
        if (msg.type === 'response' && msg.command) {
          const pending = this.pendingQueue[0]
          if (pending && pending.commandType === msg.command) {
            clearTimeout(pending.timer)
            pending.resolve(msg as RpcResponseBase)
            // prompt 命令的响应之后还有流式事件，不立即出队
            // 其他命令的响应后没有后续事件，立即出队
            if (msg.command !== 'prompt') {
              this.pendingQueue.shift()
            }
          }
          // 如果 command 类型不匹配，忽略（可能是旧命令的延迟响应）
        } else if (msg.type === 'response' && !msg.command) {
          // 某些响应可能没有 command 字段，尝试匹配队列中首个
          const pending = this.pendingQueue[0]
          if (pending) {
            clearTimeout(pending.timer)
            pending.resolve(msg as RpcResponseBase)
            this.pendingQueue.shift()
          }
        } else if (msg.type === 'extension_ui_request') {
          // 扩展 UI 请求事件也广播
          this.eventCallbacks.forEach(cb => cb(msg as AgentEvent))
        } else if (msg.type === 'agent_end') {
          // agent 完成事件：广播 + 清理 prompt 的 pending 条目
          this.eventCallbacks.forEach(cb => cb(msg as AgentEvent))
          // 如果队列头部是 prompt，出队
          if (this.pendingQueue[0]?.commandType === 'prompt') {
            this.pendingQueue.shift()
          }
        } else {
          // 普通 Agent 事件（thinking_delta, text_delta 等）
          this.eventCallbacks.forEach(cb => cb(msg as AgentEvent))
        }
      } catch (e) {
        console.error('[RPC] Failed to parse line:', line, e)
      }
    })

    proc.on('error', (err) => {
      console.error('[RPC] Process error:', err)
      if (this.proc === proc) this._running = false
    })

    proc.on('exit', (code) => {
      console.log(`[RPC] Process exited with code ${code}`)
      // 只处理当前进程的退出（避免旧进程退出覆盖新进程状态）
      if (this.proc !== proc) return
      this._running = false
      this.proc = null
      this.rl = null
      // 拒绝所有 pending 命令
      for (const p of this.pendingQueue) {
        clearTimeout(p.timer)
        p.reject(new Error('RPC process exited'))
      }
      this.pendingQueue = []
    })

    proc.stderr?.on('data', (data) => {
      console.error('[RPC stderr]', data.toString())
    })
  }

  async stop(): Promise<void> {
    const proc = this.proc
    if (!proc) {
      this._running = false
      this.eventCallbacks = []
      this.pendingQueue = []
      return
    }

    // 发 SIGTERM，等待进程退出
    proc.kill('SIGTERM')
    for (let i = 0; i < 30; i++) {
      try {
        proc.kill(0) // 空信号检测存活
        await new Promise((r) => setTimeout(r, 100))
      } catch {
        break // 进程已退出
      }
    }
    // 如果还没退出，强制杀死
    try { proc.kill('SIGKILL') } catch {}

    this._running = false
    this.eventCallbacks = []
    for (const p of this.pendingQueue) {
      clearTimeout(p.timer)
      p.reject(new Error('RPC client stopped'))
    }
    this.pendingQueue = []
  }

  onEvent(cb: (event: AgentEvent) => void): () => void {
    this.eventCallbacks.push(cb)
    return () => {
      this.eventCallbacks = this.eventCallbacks.filter(c => c !== cb)
    }
  }

  /**
   * 发送 RPC 命令，按顺序等待响应
   */
  private sendCommand(cmd: RpcCommand): Promise<RpcResponseBase> {
    return new Promise((resolve, reject) => {
      if (!this.proc?.stdin?.writable) {
        reject(new Error('RPC client not running'))
        return
      }

      const timer = setTimeout(() => {
        // 超时：从队列中移除
        const idx = this.pendingQueue.findIndex(p => p.commandType === cmd.type)
        if (idx >= 0) this.pendingQueue.splice(idx, 1)
        reject(new Error(`RPC command "${cmd.type}" timed out after 60s`))
      }, 120000)

      const entry: PendingCommand = {
        commandType: cmd.type,
        resolve,
        reject,
        timer,
      }

      this.pendingQueue.push(entry)
      this.proc.stdin!.write(JSON.stringify(cmd) + '\n')
    })
  }

  async prompt(message: string): Promise<void> {
    await this.sendCommand({ type: 'prompt', message })
  }

  async getMessages(): Promise<AgentEvent[]> {
    const res = await this.sendCommand({ type: 'get_messages' })
    if (res.success && res.data) {
      return (res.data as { messages: AgentEvent[] }).messages
    }
    throw new Error(`get_messages failed: ${res.error}`)
  }

  async switchSession(sessionPath: string): Promise<void> {
    await this.sendCommand({ type: 'switch_session', sessionPath })
  }

  async newSession(parentSession?: string): Promise<void> {
    await this.sendCommand({ type: 'new_session', parentSession })
  }

  async getState(): Promise<Record<string, unknown>> {
    const res = await this.sendCommand({ type: 'get_state' })
    if (res.success && res.data) {
      return res.data as Record<string, unknown>
    }
    throw new Error(`get_state failed: ${res.error}`)
  }

  async setModel(provider: string, modelId: string): Promise<void> {
    const res = await this.sendCommand({ type: 'set_model', provider, modelId })
    if (!res.success) {
      throw new Error(`set_model failed: ${res.error}`)
    }
  }

  async setThinkingLevel(level: string): Promise<void> {
    const res = await this.sendCommand({ type: 'set_thinking_level', level })
    if (!res.success) {
      throw new Error(`set_thinking_level failed: ${res.error}`)
    }
  }

  async compact(): Promise<{ summary: string; tokensBefore: number }> {
    const res = await this.sendCommand({ type: 'compact' })
    if (!res.success) {
      throw new Error(`compact failed: ${res.error}`)
    }
    const data = res.data as { summary: string; tokensBefore: number } | undefined
    return { summary: data?.summary || '', tokensBefore: data?.tokensBefore || 0 }
  }
}
