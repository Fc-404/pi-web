import { useState, useRef, memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { FileText, Wrench } from 'lucide-react'
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

  // 手写展开/折叠，避免 base-ui Collapsible 的定位问题
  const toolContentRef = useRef<HTMLDivElement>(null)
  const isResult = msg.role === 'toolResult'

  // 从参数 JSON 中提取摘要
  const parseSummary = (jsonStr: string): string => {
    try {
      const args = JSON.parse(jsonStr)
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
      if (msg.toolName === 'webSearch' || msg.toolName === 'web_fetch') {
        return args.query || args.url || ''
      }
      const firstVal = Object.values(args).find(v => typeof v === 'string')
      return firstVal ? (firstVal.length > 50 ? firstVal.slice(0, 50) + '...' : firstVal) : ''
    } catch {
      return ''
    }
  }

  // 摘要：toolResult 用 callArgs，toolCall 用 content
  const summarySuffix = isResult && msg.callArgs ? parseSummary(msg.callArgs)
    : !isResult && msg.content ? parseSummary(msg.content)
    : ''

  return (
    <div className="flex justify-start mb-3">
      <div className="max-w-[90%] md:max-w-[80%] rounded-2xl px-4 py-3 bg-zinc-100 text-zinc-800 rounded-bl-md">
        <div className="text-xs">
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-1.5 text-zinc-500 cursor-pointer hover:text-zinc-700 select-none w-full text-left"
          >
            <CollapseArrow open={open} />
            {(() => {
              const tn = msg.toolName || ''
              if (tn === 'read' || tn === 'write' || tn === 'edit') return <FileText className="w-3.5 h-3.5 flex-shrink-0" />
              return <Wrench className="w-3.5 h-3.5 flex-shrink-0" />
            })()}
            <span className="font-mono flex-shrink-0">{msg.toolName || (isResult ? '工具结果' : '工具调用')}</span>
            {summarySuffix && <span className="text-zinc-400 truncate ml-0.5 min-w-0">{summarySuffix}</span>}
            {msg.isError && <span className="text-red-400 ml-1 flex-shrink-0">(错误)</span>}
          </button>
          <div
            ref={toolContentRef}
            className={`overflow-auto transition-all duration-200 ${open ? 'mt-2 max-h-96' : 'max-h-0'}`}
          >
            <div className="text-[11px] leading-relaxed text-zinc-600 font-mono whitespace-pre">
              {msg.content}
            </div>
          </div>
        </div>
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

  if (msg.role === 'system') {
    return (
      <div className="flex items-center gap-3 my-3 select-none">
        <div className="flex-1 h-px bg-zinc-200" />
        <span className="text-[11px] text-zinc-400 whitespace-nowrap">{msg.content}</span>
        <div className="flex-1 h-px bg-zinc-200" />
      </div>
    )
  }

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
            <div className="mb-2 text-xs">
              <button
                onClick={() => setThinkingOpen(!thinkingOpen)}
                className="flex items-center gap-1.5 text-zinc-400 cursor-pointer hover:text-zinc-600 select-none"
              >
                <CollapseArrow open={thinkingOpen} />
                <span>思考过程</span>
              </button>
              <div className={`overflow-auto transition-all duration-200 ${thinkingOpen ? 'mt-1.5 max-h-96' : 'max-h-0'}`}>
                <div className="text-zinc-500 leading-relaxed whitespace-pre-wrap">
                  {msg.thinking}
                </div>
              </div>
            </div>
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
