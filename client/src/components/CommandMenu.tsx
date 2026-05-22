/**
 * 命令菜单 — 输入框输入 / 时弹出
 *
 * 可扩展：在 commands 数组中新增命令即可
 */
import { useState, useEffect, useRef } from 'react'

export interface Command {
  id: string
  label: string
  description: string
  execute: () => void | Promise<void>
}

export function CommandMenu({
  input,
  commands,
  onClose,
}: {
  input: string
  commands: Command[]
  onClose: () => void
}) {
  const [selectedIdx, setSelectedIdx] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)

  // 过滤：只显示匹配的命令
  const query = input.slice(1).toLowerCase() // 去掉 /
  const filtered = commands.filter(c =>
    c.id.toLowerCase().includes(query) || c.label.toLowerCase().includes(query),
  )

  // 选中第一个
  useEffect(() => { setSelectedIdx(0) }, [query])

  // 键盘导航
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIdx(i => Math.min(i + 1, filtered.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIdx(i => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' && filtered[selectedIdx]) {
        e.preventDefault()
        filtered[selectedIdx].execute()
        onClose()
      } else if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [filtered, selectedIdx, onClose])

  // 点击外部关闭
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    // 延迟注册，避免触发当前点击事件
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handler) }
  }, [onClose])

  if (filtered.length === 0) return null

  return (
    <div
      ref={menuRef}
      className="absolute bottom-full left-0 right-0 mb-1 bg-white rounded-xl border border-zinc-200 shadow-lg overflow-hidden z-50"
    >
      {filtered.map((cmd, i) => (
        <button
          key={cmd.id}
          onClick={() => { cmd.execute(); onClose() }}
          onMouseEnter={() => setSelectedIdx(i)}
          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
            i === selectedIdx ? 'bg-indigo-50 text-indigo-700' : 'text-zinc-700 hover:bg-zinc-50'
          }`}
        >
          <span className="text-sm font-mono text-zinc-400">/{cmd.id}</span>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium">{cmd.label}</span>
            <p className="text-xs text-zinc-400 truncate">{cmd.description}</p>
          </div>
        </button>
      ))}
    </div>
  )
}
