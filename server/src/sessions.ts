import { readdirSync, readFileSync, existsSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { randomUUID } from 'node:crypto'

const SESSION_DIR = join(homedir(), '.pi', 'agent', 'sessions')

export interface SessionInfo {
  id: string
  file: string          // 相对路径：组名/文件名
  startedAt: string
  title: string         // 从 jsonl 提取的标题
  isEmpty: boolean      // 只有 session header，无任何消息
}

export interface SessionGroup {
  dir: string
  cwd: string
  sessions: SessionInfo[]
}

/** 从 jsonl 首行读取 session 基本信息 */
function readSessionHeader(filePath: string): { id: string; timestamp: string; cwd: string } | null {
  try {
    const firstLine = readFileSync(filePath, 'utf-8').split('\n')[0]
    if (!firstLine) return null
    const data = JSON.parse(firstLine)
    if (data.type === 'session') {
      return { id: data.id, timestamp: data.timestamp, cwd: data.cwd }
    }
    return null
  } catch {
    return null
  }
}

/**
 * 从 jsonl 文件中提取会话标题
 * 优先级：
 *   1. session_info 行的 name 字段
 *   2. 第一条用户消息的文本
 * 只读取前 50 行，避免大文件性能开销
 */
function extractSessionTitle(filePath: string): string {
  try {
    const content = readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')
    const headerLimit = 50
    const maxLines = Math.min(lines.length, headerLimit)

    let sessionInfoName: string | null = null
    let firstUserText = ''

    // 扫描整个文件找 session_info.name（不受行数限制）
    // 第一条用户消息只在前 headerLimit 行内找（保持性能）
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      try {
        const entry = JSON.parse(line)

        // 扫描全部行找 session_info.name
        if (entry.type === 'session_info' && entry.name) {
          sessionInfoName = entry.name.trim()
        }

        // 备选：第一条用户消息（仅限前 headerLimit 行）
        if (i < maxLines && !firstUserText && entry.type === 'message' && entry.message?.role === 'user' && entry.message?.content) {
          const contentArr = Array.isArray(entry.message.content) ? entry.message.content : [entry.message.content]
          for (const part of contentArr) {
            if (part.type === 'text' && part.text) {
              firstUserText = part.text.trim()
              break
            }
          }
        }
      } catch { /* skip malformed lines */ }
    }

    // session_info.name 优先
    if (sessionInfoName) return sessionInfoName
    return firstUserText
  } catch {
    return ''
  }
}

/** 判断 jsonl 是否仅有 session header（无任何消息事件） */
function isEmptySession(filePath: string): boolean {
  try {
    const content = readFileSync(filePath, 'utf-8')
    const lines = content.trim().split('\n').filter(l => l.trim())
    return lines.length <= 1
  } catch {
    return true
  }
}

/** 从组名尝试还原工作目录 */
function groupDirToCwd(dir: string): string {
  const inner = dir.replace(/^--/, '').replace(/--$/, '')
  return '/' + inner.replace(/-/g, '/')
}

/** 获取所有会话组和会话列表 */
export function listSessions(): SessionGroup[] {
  const groups: SessionGroup[] = []

  const entries = readdirSync(SESSION_DIR, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const dir = entry.name
    const groupPath = join(SESSION_DIR, dir)

    const files = readdirSync(groupPath)
    const jsonlFiles = files.filter(f => f.endsWith('.jsonl') && !f.startsWith('.'))

    const sessions: SessionInfo[] = []
    let groupCwd: string | null = null

    for (const file of jsonlFiles) {
      const filePath = join(groupPath, file)
      const id = file.match(/_(.+?)\.jsonl$/)?.[1] || file.replace(/\.jsonl$/, '')

      const header = readSessionHeader(filePath)
      if (header?.cwd) groupCwd = header.cwd

      const title = extractSessionTitle(filePath)
      const empty = isEmptySession(filePath)

      sessions.push({
        id,
        file: `${dir}/${file}`,
        startedAt: header?.timestamp || file.split('_')[0] || '',
        title,
        isEmpty: empty,
      })
    }

    // 按时间从新到旧
    sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt))

    const cwd = groupCwd || groupDirToCwd(dir)

    groups.push({ dir, cwd, sessions })
  }

  groups.sort((a, b) => a.dir.localeCompare(b.dir))

  return groups
}

/** 获取组内最新会话文件路径 */
export function findLatestSessionFile(): string | null {
  const groups = listSessions()
  let latest: { file: string; startedAt: string } | null = null

  for (const group of groups) {
    for (const session of group.sessions) {
      if (!latest || session.startedAt > latest.startedAt) {
        latest = { file: session.file, startedAt: session.startedAt }
      }
    }
  }

  return latest?.file || null
}

// ===== 文件创建/删除（与 PiPool 解耦） =====

/** 工作目录路径编码为组目录名 */
export function encodeGroupName(workDir: string): string {
  return '--' + workDir.replace(/^\//, '').replace(/\//g, '-') + '--'
}

/** 创建新的会话 jsonl 文件，返回相对路径和绝对路径 */
export function createSessionFile(cwd?: string): { relativePath: string; fullPath: string } {
  const workDir = cwd || homedir()
  const groupName = encodeGroupName(workDir)
  const sessionId = randomUUID()
  const timestamp = new Date().toISOString()
  const fileName = timestamp.replace(/:/g, '-') + '_' + sessionId + '.jsonl'
  const relativePath = groupName + '/' + fileName
  const fullPath = join(SESSION_DIR, groupName, fileName)

  mkdirSync(dirname(fullPath), { recursive: true })
  writeFileSync(fullPath, JSON.stringify({
    type: 'session', version: 3, id: sessionId, timestamp, cwd: workDir,
  }) + '\n')

  return { relativePath, fullPath }
}

/** 删除会话文件（jsonl + meta） */
export function deleteSessionFiles(sessionFile: string): void {
  const fullPath = sessionFile.startsWith('/')
    ? sessionFile
    : join(SESSION_DIR, sessionFile)

  if (existsSync(fullPath)) unlinkSync(fullPath)
  // meta.json 可能由其他插件生成，尝试删除但不报错
  const metaPath = fullPath.replace(/\.jsonl$/, '.meta.json')
  if (existsSync(metaPath)) unlinkSync(metaPath)
}

/** 更新会话标题（追加 session_info 事件到 jsonl） */
export function renameSession(sessionFile: string, newName: string): boolean {
  const fullPath = sessionFile.startsWith('/')
    ? sessionFile
    : join(SESSION_DIR, sessionFile)

  if (!existsSync(fullPath)) return false

  writeFileSync(fullPath, JSON.stringify({
    type: 'session_info',
    id: randomUUID(),
    parentId: null,
    timestamp: new Date().toISOString(),
    name: newName,
  }) + '\n', { flag: 'a' })

  return true
}
