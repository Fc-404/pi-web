import { useState, useEffect } from 'react'
import { Sparkles, Wrench } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'

const THINKING_LEVELS = ['off', 'high', 'xhigh'] as const

// localStorage key
const LS_PREFIX = 'piweb-settings'

function loadSetting<T>(key: string, fallback: T): T {
  try {
    const val = localStorage.getItem(LS_PREFIX + '-' + key)
    return val !== null ? JSON.parse(val) : fallback
  } catch {
    return fallback
  }
}

function saveSetting<T>(key: string, val: T) {
  localStorage.setItem(LS_PREFIX + '-' + key, JSON.stringify(val))
}

export function useSettings() {
  const [thinkingDefaultOpen, setThinkingDefaultOpen] = useState(() => loadSetting('thinkingDefaultOpen', false))
  const [toolCallDefaultOpen, setToolCallDefaultOpen] = useState(() => loadSetting('toolCallDefaultOpen', false))
  const [showFooterTime, setShowFooterTime] = useState(() => loadSetting('showFooterTime', true))
  const [showFooterInput, setShowFooterInput] = useState(() => loadSetting('showFooterInput', true))
  const [showFooterOutput, setShowFooterOutput] = useState(() => loadSetting('showFooterOutput', true))
  const [showFooterCache, setShowFooterCache] = useState(() => loadSetting('showFooterCache', true))
  const [showFooterCost, setShowFooterCost] = useState(() => loadSetting('showFooterCost', true))

  useEffect(() => { saveSetting('thinkingDefaultOpen', thinkingDefaultOpen) }, [thinkingDefaultOpen])
  useEffect(() => { saveSetting('toolCallDefaultOpen', toolCallDefaultOpen) }, [toolCallDefaultOpen])
  useEffect(() => { saveSetting('showFooterTime', showFooterTime) }, [showFooterTime])
  useEffect(() => { saveSetting('showFooterInput', showFooterInput) }, [showFooterInput])
  useEffect(() => { saveSetting('showFooterOutput', showFooterOutput) }, [showFooterOutput])
  useEffect(() => { saveSetting('showFooterCache', showFooterCache) }, [showFooterCache])
  useEffect(() => { saveSetting('showFooterCost', showFooterCost) }, [showFooterCost])

  return {
    thinkingDefaultOpen, setThinkingDefaultOpen,
    toolCallDefaultOpen, setToolCallDefaultOpen,
    showFooterTime, setShowFooterTime,
    showFooterInput, setShowFooterInput,
    showFooterOutput, setShowFooterOutput,
    showFooterCache, setShowFooterCache,
    showFooterCost, setShowFooterCost,
  }
}

interface ModelOption {
  provider: string
  modelId: string
  context: string
  thinking: boolean
}

const modelLabels: Record<string, string> = {
  'deepseek-v4-flash': 'DeepSeek V4 Flash',
  'deepseek-v4-pro': 'DeepSeek V4 Pro',
  'glm-5': 'GLM-5',
  'glm-5.1': 'GLM-5.1',
  'kimi-k2.5': 'Kimi K2.5',
  'kimi-k2.6': 'Kimi K2.6',
  'mimo-v2.5': 'Mimo V2.5',
  'mimo-v2.5-pro': 'Mimo V2.5 Pro',
  'minimax-m2.5': 'MiniMax M2.5',
  'minimax-m2.7': 'MiniMax M2.7',
  'qwen3.5-plus': 'Qwen 3.5 Plus',
  'qwen3.6-plus': 'Qwen 3.6 Plus',
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
        value ? 'bg-indigo-500' : 'bg-zinc-300'
      }`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
        value ? 'translate-x-5' : ''
      }`} />
    </button>
  )
}

export function SettingsPanel({
  open,
  onClose,
  onApply,
  activeId,
  thinkingDefaultOpen,
  onThinkingDefaultOpenChange,
  toolCallDefaultOpen,
  onToolCallDefaultOpenChange,
  showFooterTime,
  onShowFooterTimeChange,
  showFooterInput,
  onShowFooterInputChange,
  showFooterOutput,
  onShowFooterOutputChange,
  showFooterCache,
  onShowFooterCacheChange,
  showFooterCost,
  onShowFooterCostChange,
}: {
  open: boolean
  onClose: () => void
  onApply?: (settings: { modelId: string; thinkingLevel: string }) => void
  activeId?: string | null
  thinkingDefaultOpen: boolean
  onThinkingDefaultOpenChange: (v: boolean) => void
  toolCallDefaultOpen: boolean
  onToolCallDefaultOpenChange: (v: boolean) => void
  showFooterTime?: boolean
  onShowFooterTimeChange?: (v: boolean) => void
  showFooterInput?: boolean
  onShowFooterInputChange?: (v: boolean) => void
  showFooterOutput?: boolean
  onShowFooterOutputChange?: (v: boolean) => void
  showFooterCache?: boolean
  onShowFooterCacheChange?: (v: boolean) => void
  showFooterCost?: boolean
  onShowFooterCostChange?: (v: boolean) => void
}) {
  const [models, setModels] = useState<ModelOption[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [selectedModel, setSelectedModel] = useState('')
  const [selectedThinking, setSelectedThinking] = useState('high')
  const [initialModel, setInitialModel] = useState('')
  const [initialThinking, setInitialThinking] = useState('high')

  // 打开时获取数据
  useEffect(() => {
    if (!open) return

    // 获取模型列表
    setLoadingModels(true)
    fetch('/api/models')
      .then(res => res.json())
      .then(data => {
        if (data.models) setModels(data.models)
      })
      .catch(() => {})
      .finally(() => setLoadingModels(false))

    // 获取当前会话状态
    if (activeId) {
      fetch(`/api/sessions/state?file=${encodeURIComponent(activeId)}`)
        .then(res => res.json())
        .then(data => {
          if (data.model?.id) {
            const mid = data.model.id
            setSelectedModel(mid)
            setInitialModel(mid)
          }
          if (data.thinkingLevel) {
            setSelectedThinking(data.thinkingLevel)
            setInitialThinking(data.thinkingLevel)
          }
        })
        .catch(() => {})
    }
  }, [open, activeId])

  const hasChanges = selectedModel !== initialModel || selectedThinking !== initialThinking

  const handleApply = () => {
    onApply?.({ modelId: selectedModel, thinkingLevel: selectedThinking })
    onClose()
  }

  const handleCancel = () => {
    setSelectedModel(initialModel)
    setSelectedThinking(initialThinking)
    onClose()
  }

  if (!open) return null

  return (
    <>
      {/* 遮罩 */}
      <div className="fixed inset-0 z-[150] bg-black/20 backdrop-blur-sm" onClick={handleCancel} />

      {/* 面板 */}
      <div className="fixed inset-0 z-[160] flex items-start justify-center pt-8 sm:pt-20 pointer-events-none">
        <div
          className="pointer-events-auto w-[calc(100%-2rem)] sm:w-full max-w-md bg-white rounded-2xl shadow-xl border border-zinc-200 flex flex-col max-h-[80vh]"
          onClick={e => e.stopPropagation()}
        >
          {/* 头部 */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 flex-shrink-0">
            <h2 className="text-base font-semibold text-zinc-800">聊天设置</h2>
          </div>

          {/* 内容区 — 上下滑动 */}
          <ScrollArea className="flex-1 min-h-0 p-5">
          <div className="space-y-6">

            {/* === 分组：AI 参数 === */}
            <section>
              <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">AI 参数</h3>
              <div className="space-y-4">
                {/* 模型选择 */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">模型</label>
                  {loadingModels ? (
                    <Skeleton className="h-9 w-full rounded-lg" />
                  ) : (
                    <select
                      value={selectedModel}
                      onChange={e => setSelectedModel(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-zinc-300 bg-white text-sm
                                 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    >
                      {models.length === 0 && <option value="">暂无可用模型</option>}
                      {models.map(m => {
                        const label = modelLabels[m.modelId] || m.modelId
                        return (
                          <option key={m.modelId} value={m.modelId}>
                            {label} ({m.provider})
                          </option>
                        )
                      })}
                    </select>
                  )}
                  <p className="text-[11px] text-zinc-400 mt-1">切换后需要重启会话</p>
                </div>

                {/* 思考模式 */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">思考模式</label>
                  <select
                    value={selectedThinking}
                    onChange={e => setSelectedThinking(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 bg-white text-sm
                               focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    {THINKING_LEVELS.map(level => (
                      <option key={level} value={level}>{level}</option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            {/* === 分组：折叠默认状态 === */}
            <section>
              <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">折叠默认状态</h3>
              <div className="space-y-3">
                <label className="flex items-center justify-between py-2">
                  <span className="text-sm text-zinc-700 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-zinc-400" />
                    思考过程
                  </span>
                  <Toggle value={thinkingDefaultOpen} onChange={onThinkingDefaultOpenChange} />
                </label>
                <label className="flex items-center justify-between py-2">
                  <span className="text-sm text-zinc-700 flex items-center gap-1.5">
                    <Wrench className="w-4 h-4 text-zinc-400" />
                    工具调用
                  </span>
                  <Toggle value={toolCallDefaultOpen} onChange={onToolCallDefaultOpenChange} />
                </label>
              </div>
              <p className="text-[11px] text-zinc-400 mt-2">这些设置会自动保存</p>
            </section>

            {/* === 分组：气泡尾部信息 === */}
            <section>
              <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">气泡尾部信息</h3>
              <div className="space-y-3">
                <label className="flex items-center justify-between py-2">
                  <span className="text-sm text-zinc-700">时间</span>
                  <Toggle value={showFooterTime ?? true} onChange={v => onShowFooterTimeChange?.(v)} />
                </label>
                <label className="flex items-center justify-between py-2">
                  <span className="text-sm text-zinc-700">输入(in)</span>
                  <Toggle value={showFooterInput ?? true} onChange={v => onShowFooterInputChange?.(v)} />
                </label>
                <label className="flex items-center justify-between py-2">
                  <span className="text-sm text-zinc-700">输出(out)</span>
                  <Toggle value={showFooterOutput ?? true} onChange={v => onShowFooterOutputChange?.(v)} />
                </label>
                <label className="flex items-center justify-between py-2">
                  <span className="text-sm text-zinc-700">缓存命中(cache)</span>
                  <Toggle value={showFooterCache ?? true} onChange={v => onShowFooterCacheChange?.(v)} />
                </label>
                <label className="flex items-center justify-between py-2">
                  <span className="text-sm text-zinc-700">花费</span>
                  <Toggle value={showFooterCost ?? true} onChange={v => onShowFooterCostChange?.(v)} />
                </label>
              </div>
              <p className="text-[11px] text-zinc-400 mt-2">这些设置会自动保存</p>
            </section>

          </div>
          </ScrollArea>

          {/* 底部按钮 */}
          <div className="flex items-center gap-3 px-5 py-4 border-t border-zinc-100 flex-shrink-0">
            <button
              onClick={handleCancel}
              className="flex-1 px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-sm font-medium transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleApply}
              disabled={!hasChanges}
              className="flex-1 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:bg-zinc-300 text-white rounded-xl text-sm font-medium transition-colors"
            >
              应用
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
