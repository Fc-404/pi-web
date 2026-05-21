import { useState, useRef, memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible'
import type { HistoryMessage } from '../lib/api'

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
          <a href={href} target="_blank" rel="noreferrer" className="text-sky-600 underline hover:text-sky-700">{children}</a>
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

// ===== 工具调用气泡 =====

function ToolCallBubble({ msg }: { msg: HistoryMessage }) {
  const [open, setOpen] = useState(false)
  const isResult = msg.role === 'toolResult'

  // 从 arguments JSON 中提取命令/文件摘要
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
      // 通用：取第一个字符串值
      const firstVal = Object.values(args).find(v => typeof v === 'string')
      return firstVal ? (firstVal.length > 50 ? firstVal.slice(0, 50) + '...' : firstVal) : ''
    } catch {
      return msg.content.length > 50 ? msg.content.slice(0, 50) + '...' : msg.content
    }
  })()

  return (
    <div className="flex justify-start mb-3">
      <div className="max-w-[90%] md:max-w-[80%] rounded-2xl px-4 py-3 bg-zinc-100 text-zinc-800 rounded-bl-md">
        <details className="text-xs group" onToggle={(e) => setOpen(e.currentTarget.open)}>
          <summary className="flex items-center gap-1.5 text-zinc-500 cursor-pointer hover:text-zinc-700 select-none [&::-webkit-details-marker]:hidden list-none">
            {/* 自定义折叠三角 */}
            <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span>{isResult ? '📋' : '🔧'}</span>
            <span className="font-mono">{msg.toolName || (isResult ? '工具结果' : '工具调用')}</span>
            {summarySuffix && <span className="text-zinc-400 truncate ml-0.5">{summarySuffix}</span>}
            {msg.isError && <span className="text-red-400 ml-1">(错误)</span>}
          </summary>
          <pre className="mt-2 text-[11px] leading-relaxed text-zinc-600 max-h-48 overflow-y-auto whitespace-pre-wrap break-words">
            {msg.content}
          </pre>
        </details>
      </div>
    </div>
  )
}

// ===== 消息气泡 =====

function MessageBubbleInner({ msg, prevRole, nextRole }: { msg: HistoryMessage; prevRole?: string; nextRole?: string }) {
  const [fullscreen, setFullscreen] = useState(false)

  if (msg.role === 'toolCall' || msg.role === 'toolResult') {
    return <ToolCallBubble msg={msg} />
  }

  const isUser = msg.role === 'user'

  return (
    <>
      <div
        className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
        onDoubleClick={() => setFullscreen(true)}
      >
        <div className={`max-w-[90%] md:max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser ? 'bg-sky-500 text-white rounded-br-md' : 'bg-zinc-100 text-zinc-800 rounded-bl-md'
        }`}>
          {msg.thinking && (
            <details className="mb-2 text-xs" onToggle={(e) => {
              const detail = e.currentTarget
              const arrow = detail.querySelector('.thinking-arrow')
              if (arrow) arrow.classList.toggle('rotate-90', detail.open)
            }}>
              <summary className="flex items-center gap-1.5 text-zinc-400 cursor-pointer hover:text-zinc-600 select-none [&::-webkit-details-marker]:hidden list-none">
                <svg className="thinking-arrow w-3 h-3 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span>思考过程</span>
              </summary>
              <div className="mt-1.5 text-zinc-500 leading-relaxed whitespace-pre-wrap">{msg.thinking}</div>
            </details>
          )}
          <div className={`text-sm whitespace-pre-wrap break-words ${isUser ? '' : 'markdown-body'}`}>
            {isUser ? msg.content : <MarkdownContent content={msg.content} />}
          </div>
        </div>
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
