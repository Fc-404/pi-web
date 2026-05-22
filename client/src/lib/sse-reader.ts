/**
 * SSE 流读取器
 *
 * 纯工具：从 ReadableStream 中逐行解析 SSE 事件。
 * 不涉及 React 状态或 UI 逻辑，可独立测试。
 */

/**
 * 从 ReadableStream 中异步生成 SSE 事件对象
 *
 * 处理：
 * - TextDecoder 流式解码
 * - 行缓冲和分割
 * - 跳过 event: 行和空 data: 行
 * - JSON 解析
 */
export async function* readSSEEvents(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): AsyncGenerator<Record<string, unknown>> {
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    // 最后一个元素可能是不完整的行，保留到下次
    buffer = lines.pop() || ''

    for (const line of lines) {
      // SSE 格式：event: xxx\ndata: {...}\n\n
      // 跳过 event: 行和空行，只处理 data: 行
      if (line.startsWith('event: ') || !line.startsWith('data: ')) continue

      const dataStr = line.slice(6) // 去掉 "data: "
      if (!dataStr) continue

      try {
        yield JSON.parse(dataStr) as Record<string, unknown>
      } catch {
        // 跳过格式异常的 data 行
      }
    }
  }
}
