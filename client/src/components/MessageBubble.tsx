import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible'
import type { HistoryMessage } from '../lib/api'

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
        ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
        code: ({ className, children, ...props }) => {
          const isInline = !className
          if (isInline) return <code className="bg-zinc-200/70 rounded px-1.5 py-0.5 text-xs font-mono">{children}</code>
          return (
            <pre className="bg-zinc-800 text-zinc-100 rounded-xl p-4 my-3 overflow-x-auto text-xs leading-relaxed">
              <code className={className} {...props}>{children}</code>
            </pre>
          )
        },
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noreferrer" className="text-sky-600 underline hover:text-sky-700">{children}</a>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto my-3">
            <table className="min-w-full text-xs border-collapse border border-zinc-200">{children}</table>
          </div>
        ),
        th: ({ children }) => <th className="border border-zinc-200 bg-zinc-50 px-3 py-2 font-medium text-left">{children}</th>,
        td: ({ children }) => <td className="border border-zinc-200 px-3 py-2">{children}</td>,
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

function ToolCallBubble({ msg }: { msg: HistoryMessage }) {
  const [expanded, setExpanded] = useState(false)
  const isResult = msg.role === 'toolResult'

  return (
    <div className="flex justify-start mb-3">
      <div className="max-w-[85%] md:max-w-[75%]">
        <div className="flex items-center gap-1.5 mb-1 text-xs text-zinc-400">
          <span>{isResult ? '📋' : '🔧'}</span>
          <span className="font-mono">{msg.toolName || (isResult ? '工具结果' : '工具调用')}</span>
          {msg.isError && <span className="text-red-400">(错误)</span>}
        </div>
        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <CollapsibleTrigger
            className="w-full flex items-center justify-between px-3 py-2 text-xs text-zinc-500 bg-zinc-50 border border-zinc-200 hover:bg-zinc-100 transition-colors rounded-t-xl data-[open]:rounded-b-none data-[open]:rounded-xl"
          >
            <span>{expanded ? '收起' : '展开'}</span>
            <svg className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="text-[11px] leading-relaxed text-zinc-600 p-3 max-h-48 overflow-y-auto whitespace-pre-wrap break-words bg-zinc-50 border border-t-0 border-zinc-200 rounded-b-xl">
              {msg.content}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  )
}

export function MessageBubble({ msg }: { msg: HistoryMessage }) {
  if (msg.role === 'toolCall' || msg.role === 'toolResult') {
    return <ToolCallBubble msg={msg} />
  }

  const isUser = msg.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[80%] md:max-w-[70%] rounded-2xl px-4 py-3 ${
        isUser ? 'bg-sky-500 text-white rounded-br-md' : 'bg-zinc-100 text-zinc-800 rounded-bl-md'
      }`}>
        {msg.thinking && (
          <details className="mb-2 text-xs">
            <summary className="text-zinc-400 cursor-pointer hover:text-zinc-600">思考过程</summary>
            <div className="mt-1.5 text-zinc-500 leading-relaxed">{msg.thinking}</div>
          </details>
        )}
        <div className={`text-sm whitespace-pre-wrap break-words overflow-x-auto ${isUser ? '' : 'markdown-body'}`}>
          {isUser ? msg.content : <MarkdownContent content={msg.content} />}
        </div>
      </div>
    </div>
  )
}
