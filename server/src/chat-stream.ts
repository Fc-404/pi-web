/**
 * ChatStream — SSE 流式聊天管道
 *
 * 职责：将 PiPool 的事件流通过 Hono SSE 管道输出到客户端。
 * 被 index.ts 的路由调用，解耦 SSE 轮询逻辑与路由注册。
 *
 * 依赖注入 PiPool，便于测试时 mock。
 */

import type { SSEStreamingApi } from 'hono/streaming'
import type { PiPool } from './pi-pool.js'
import type { AgentEvent } from './rpc-client.js'

/**
 * 将 PiPool 的聊天事件通过 SSE 流式输出
 *
 * 1. 订阅 PiPool 事件
 * 2. 发送 prompt 消息
 * 3. 轮询事件队列，逐个写入 SSE
 * 4. agent_end 时结束，写入 done 事件
 * 5. 清理订阅
 *
 * @param stream - Hono SSE 流对象
 * @param pool - PiPool 实例
 * @param message - 用户消息
 */
export async function pipeChatToSSE(
  stream: SSEStreamingApi,
  pool: PiPool,
  message: string,
): Promise<void> {
  const eventQueue: AgentEvent[] = []
  let resolveEvent: (() => void) | null = null

  const unsub = pool.onEvent((event) => {
    eventQueue.push(event)
    if (resolveEvent) {
      resolveEvent()
      resolveEvent = null
    }
  })

  try {
    await pool.prompt(message)

    while (true) {
      if (eventQueue.length === 0) {
        await new Promise<void>((resolve) => {
          resolveEvent = resolve
        })
      }
      const event = eventQueue.shift()!
      if (event.type === 'agent_end') break
      await stream.writeSSE({ event: event.type, data: JSON.stringify(event) })
    }

    await stream.writeSSE({ event: 'done', data: '' })
  } finally {
    unsub()
  }
}
