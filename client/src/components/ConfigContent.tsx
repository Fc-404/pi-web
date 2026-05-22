/**
 * 配置内容 — 嵌入主内容区
 *
 * 顶部导航标签（滑动指示条动画）
 * 扁平化布局，非卡片式，PC 端自适应宽度
 */
import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { getToken } from '../lib/auth'
import { LoadingDots } from './LoadingDots'

type Tab = 'settings' | 'prompts' | 'service' | 'about'

const tabs: { key: Tab; label: string }[] = [
  { key: 'settings', label: '设置' },
  { key: 'prompts', label: '提示词' },
  { key: 'service', label: '服务' },
  { key: 'about', label: '关于' },
]

export function ConfigContent({ onToggleSidebar }: { onToggleSidebar?: () => void }) {
  const [activeTab, setActiveTab] = useState<Tab>('settings')
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [indicator, setIndicator] = useState({ left: 0, width: 0 })

  useEffect(() => {
    const idx = tabs.findIndex(t => t.key === activeTab)
    const el = tabRefs.current[idx]
    if (el) {
      setIndicator({ left: el.offsetLeft, width: el.offsetWidth })
    }
  }, [activeTab])

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* 导航标签 — 单一容器响应式，与 ChatHeader 同高 */}
      <div className="border-b border-zinc-200 bg-white flex-shrink-0">
        {/* 容器样式与 ChatHeader 完全一致 */}
        <div className="flex items-center gap-2 px-4 md:px-5 py-3">
          {/* 移动端汉堡菜单 */}
          {onToggleSidebar && (
            <Button variant="ghost" size="icon-sm" onClick={onToggleSidebar} className="md:hidden flex-shrink-0 self-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </Button>
          )}
          {/* 标签容器 */}
          <div className="relative flex items-end gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden flex-1 self-stretch">
            {tabs.map((tab, i) => (
              <button
                key={tab.key}
                ref={(el) => { tabRefs.current[i] = el }}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 pb-3 pt-3 text-sm whitespace-nowrap flex-shrink-0 transition-colors ${
                  activeTab === tab.key
                    ? 'text-indigo-600 font-medium'
                    : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
            <div
              className="absolute bottom-0 h-0.5 bg-indigo-500 transition-all duration-300 ease-out"
              style={{ left: indicator.left, width: indicator.width }}
            />
          </div>
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto bg-zinc-50">
        <div className="px-6 md:px-12 py-8 md:py-10 max-w-2xl">
          {activeTab === 'settings' && <SettingsForm />}
          {activeTab === 'prompts' && (
            <p className="text-zinc-400 text-sm">提示词管理（开发中）</p>
          )}
          {activeTab === 'service' && (
            <p className="text-zinc-400 text-sm">服务管理（开发中）</p>
          )}
          {activeTab === 'about' && (
            <p className="text-zinc-400 text-sm">关于（开发中）</p>
          )}
        </div>
      </div>
    </div>
  )
}

/** 修改密码 — 扁平化，非卡片，自适应宽度 */
function SettingsForm() {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: '两次密码不一致' })
      return
    }
    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: '密码至少 6 位' })
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ oldPassword, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || '修改失败' })
        return
      }
      setMessage({ type: 'success', text: '密码已修改' })
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch {
      setMessage({ type: 'error', text: '网络错误' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <section>
      <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-6">安全设置</h3>

      <div className="divide-y divide-zinc-200">
        <div className="py-4 flex flex-col sm:flex-row sm:items-center gap-2">
          <label className="text-sm text-zinc-600 sm:w-28 flex-shrink-0">旧密码</label>
          <input
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-zinc-300 bg-white text-sm
                       outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            placeholder="输入当前密码"
          />
        </div>

        <div className="py-4 flex flex-col sm:flex-row sm:items-center gap-2">
          <label className="text-sm text-zinc-600 sm:w-28 flex-shrink-0">新密码</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-zinc-300 bg-white text-sm
                       outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            placeholder="至少 6 位"
          />
        </div>

        <div className="py-4 flex flex-col sm:flex-row sm:items-center gap-2">
          <label className="text-sm text-zinc-600 sm:w-28 flex-shrink-0">确认新密码</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-zinc-300 bg-white text-sm
                       outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            placeholder="再次输入新密码"
          />
        </div>
      </div>

      {message && (
        <p className={`mt-4 text-sm ${message.type === 'success' ? 'text-emerald-600' : 'text-red-500'}`}>
          {message.text}
        </p>
      )}

      <div className="mt-6">
        <button
          type="submit"
          disabled={loading || !oldPassword || !newPassword || !confirmPassword}
          className="px-6 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:bg-zinc-300 text-white text-sm font-medium transition-colors"
          onClick={handleSubmit}
        >
          {loading ? <LoadingDots size="sm" color="white" /> : '更新密码'}
        </button>
        <p className="text-[11px] text-zinc-400 mt-2">修改密码后所有登录设备将立即失效</p>
      </div>
    </section>
  )
}
