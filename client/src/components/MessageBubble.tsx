import { useState, useRef, memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { FileText, Wrench } from 'lucide-react'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible'
import type { HistoryMessage } from '../lib/api'

// ===== 统一折叠箭头 =====

function loadSetting<T>(key: string, fallback: T): T {
  try {
    const val = localStorage.getItem('piweb-settings-' + key)
    return val !== null ? JSON.parse(val) : fallback
  } catch {
    return fallback
  }
}

function CollapseArrow({ open }: { open: boolean }) {
  return (
    <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  )
}

// ===== 横向滚动位置保持组件 =====

function ScrollablePre({ children, className }: { children: React.ReactNode; className?: string }) {
  const scrollLeftRef = useRef(0)

  return (
    <pre
      ref={(el) => { if (el) el.scrollLeft = scrollLeftRef.current }}
      className={className}
      onScroll={(e) => { scrollLeftRef.current = e.currentTarget.scrollLeft }}
    >
      {children}
    </pre>
  )
}

function ScrollableDiv({ children, className }: { children: React.ReactNode; className?: string }) {
  const scrollLeftRef = useRef(0)

  return (
    <div
      ref={(el) => { if (el) el.scrollLeft = scrollLeftRef.current }}
      className={className}
      onScroll={(e) => { scrollLeftRef.current = e.currentTarget.scrollLeft }}
    >
      {children}
    </div>
  )
}

// ===== Markdown 渲染 =====

function MarkdownContentInner({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
        ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
        code: ({ className, children, ...props }) => {
          const isInline = !className
          if (isInline) return <code className="bg-zinc-200/70 rounded px-1.5 py-0.5 text-xs font-mono break-words whitespace-pre-wrap">{children}</code>
          return (
            <ScrollablePre className="bg-zinc-800 text-zinc-100 rounded-xl p-4 my-3 overflow-x-auto text-xs leading-relaxed">
              <code className={className} {...props}>{children}</code>
            </ScrollablePre>
          )
        },
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noreferrer" className="text-indigo-600 underline hover:text-indigo-700">{children}</a>
        ),
        table: ({ children }) => (
          <ScrollableDiv className="overflow-x-auto my-3">
            <table className="min-w-full text-xs border-collapse border border-zinc-200">{children}</table>
          </ScrollableDiv>
        ),
        th: ({ children }) => <th className="border border-zinc-200 bg-zinc-50 px-3 py-2 font-medium text-left">{children}</th>,
        td: ({ children }) => <td className="border border-zinc-200 px-3 py-2">{children}</td>,
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
const MarkdownContent = memo(MarkdownContentInner)

// ===== 全屏预览组件 =====

function FullscreenPreview({ content, isUser, onClose }: { content: string; isUser: boolean; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[200] bg-white overflow-auto p-4 md:p-8"
      onDoubleClick={onClose}
    >
      <div className="max-w-4xl mx-auto">
        <div className={`text-sm whitespace-pre-wrap break-words ${isUser ? '' : 'markdown-body'}`}>
          {isUser ? (
            <p className="leading-relaxed whitespace-pre-wrap">{content}</p>
          ) : (
            <MarkdownContent content={content} />
          )}
        </div>
      </div>
    </div>
  )
}

// ===== 工具调用气泡（统一用 Collapsible） =====

function ToolCallBubble({ msg }: { msg: HistoryMessage }) {
  const [open, setOpen] = useState(() => {
    try { return JSON.parse(localStorage.getItem('piweb-settings-toolCallDefaultOpen') || 'false') }
    catch { return false }
  })
  const isResult = msg.role === 'toolResult'

  // 摘要：始终显示工具名 + 操作的文件/命令（不因结果而改变）
  const summarySuffix = (() => {
    if (!msg.content) return ''
    try {
      const args = JSON.parse(msg.content)
      if (msg.toolName === 'read' || msg.toolName === 'write' || msg.toolName === 'edit') {
        return args.filePath || args.path || args.file || ''
      }
      if (msg.toolName === 'bash') {
        const cmd = args.command || args.cmd || ''
        return cmd.length > 50 ? cmd.slice(0, 50) + '...' : cmd
      }
      if (msg.toolName === 'search' || msg.toolName === 'grep') {
        return args.pattern || args.query || args.text || ''
      }
      const firstVal = Object.values(args).find(v => typeof v === 'string')
      return firstVal ? (firstVal.length > 50 ? firstVal.slice(0, 50) + '...' : firstVal) : ''
    } catch {
      // toolResult 的 content 是文本不是 JSON，摘要显示操作的工具名即可
      return ''
    }
  })()

  return (
    <div className="flex justify-start mb-3">
      <div className="max-w-[90%] md:max-w-[80%] rounded-2xl px-4 py-3 bg-zinc-100 text-zinc-800 rounded-bl-md">
        <Collapsible open={open} onOpenChange={setOpen} className="text-xs">
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-1.5 text-zinc-500 cursor-pointer hover:text-zinc-700 select-none w-full text-left">
              <CollapseArrow open={open} />
              {isResult ? (
                <FileText className="w-3.5 h-3.5 flex-shrink-0" />
              ) : (
                <Wrench className="w-3.5 h-3.5 flex-shrink-0" />
              )}
              <span className="font-mono">{msg.toolName || (isResult ? '工具结果' : '工具调用')}</span>
              {summarySuffix && <span className="text-zinc-400 truncate ml-0.5">{summarySuffix}</span>}
              {msg.isError && <span className="text-red-400 ml-1">(错误)</span>}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <pre className="text-[11px] leading-relaxed text-zinc-600 max-h-48 overflow-y-auto whitespace-pre-wrap break-words">
              {msg.content}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  )
}

function formatMsgTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const isToday = d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate()
  const time = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  if (isToday) return time
  const date = d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  return `${date} ${time}`
}

// ===== 消息气泡 =====

function MessageBubbleInner({ msg, prevRole, nextRole }: { msg: HistoryMessage; prevRole?: string; nextRole?: string }) {
  const [fullscreen, setFullscreen] = useState(false)
  const [thinkingOpen, setThinkingOpen] = useState(() => {
    try { return JSON.parse(localStorage.getItem('piweb-settings-thinkingDefaultOpen') || 'false') }
    catch { return false }
  })

  if (msg.role === 'toolCall' || msg.role === 'toolResult') {
    return <ToolCallBubble msg={msg} />
  }

  const isUser = msg.role === 'user'

  return (
    <>
      <div
        className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} mb-4`}
        onDoubleClick={() => setFullscreen(true)}
      >
        <div className={`max-w-[90%] md:max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser ? 'bg-indigo-500 text-white rounded-br-md' : 'bg-zinc-100 text-zinc-800 rounded-bl-md'
        }`}>
          {msg.thinking && (
            <Collapsible open={thinkingOpen} onOpenChange={setThinkingOpen} className="mb-2 text-xs">
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-1.5 text-zinc-400 cursor-pointer hover:text-zinc-600 select-none">
                  <CollapseArrow open={thinkingOpen} />
                  <span>思考过程</span>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-1.5 text-zinc-500 leading-relaxed whitespace-pre-wrap">
                {msg.thinking}
              </CollapsibleContent>
            </Collapsible>
          )}
          <div className={`text-sm whitespace-pre-wrap break-words ${isUser ? '' : 'markdown-body'}`}>
            {isUser ? msg.content : <MarkdownContent content={msg.content} />}
          </div>
        </div>

        {/* 信息栏 — 气泡外部，仅 assistant 消息 */}
        {!isUser && msg.usage && (() => {
          const showTime = loadSetting('showFooterTime', true)
          const showInput = loadSetting('showFooterInput', true)
          const showOutput = loadSetting('showFooterOutput', true)
          const showCache = loadSetting('showFooterCache', true)
          const showCost = loadSetting('showFooterCost', true)
          const hasAny = showTime || showInput || showOutput || showCache || showCost
          if (!hasAny) return null
          return (
            <div className="flex items-center gap-8 mt-0.5 px-1 text-[10px] text-zinc-400 select-none">
              <span>
                {showTime && msg.timestamp ? formatMsgTime(msg.timestamp) : ''}
              </span>
              <div className="flex items-center gap-2">
                {showInput && msg.usage.input > 0 && <span>in {msg.usage.input}</span>}
                {showOutput && msg.usage.output > 0 && <span>out {msg.usage.output}</span>}
                {showCache && msg.usage.cacheRead > 0 && <span>cache {msg.usage.cacheRead}</span>}
                {showCost && msg.usage.cost?.total > 0 && (
                  <span className="font-mono">${msg.usage.cost.total.toFixed(6)}</span>
                )}
              </div>
            </div>
          )
        })()}
      </div>
      {fullscreen && (
        <FullscreenPreview
          content={msg.content}
          isUser={isUser}
          onClose={() => setFullscreen(false)}
        />
      )}
    </>
  )
}
export const MessageBubble = memo(MessageBubbleInner)
