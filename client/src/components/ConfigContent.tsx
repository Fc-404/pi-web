/**
 * 配置内容 — 嵌入主内容区
 *
 * 顶部导航标签（滑动指示条动画）
 * [设置] [提示词] [服务]  ← 扩展预留
 */
import { useState, useRef, useEffect } from 'react'
import { getToken } from '../lib/auth'
import { LoadingDots } from './LoadingDots'

type Tab = 'settings'

const tabs: { key: Tab; label: string }[] = [
  { key: 'settings', label: '设置' },
]

export function ConfigContent() {
  const [activeTab, setActiveTab] = useState<Tab>('settings')
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const navRef = useRef<HTMLDivElement>(null)
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
      {/* 导航标签 — 滑动指示条 */}
      <div className="border-b border-zinc-200 bg-white flex-shrink-0">
        <div
          ref={navRef}
          className="relative flex overflow-x-auto [&::-webkit-scrollbar]:hidden px-5"
        >
          {tabs.map((tab, i) => (
            <button
              key={tab.key}
              ref={(el) => { tabRefs.current[i] = el }}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 text-sm whitespace-nowrap flex-shrink-0 transition-colors ${
                activeTab === tab.key
                  ? 'text-zinc-900 font-medium'
                  : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
          {/* 滑动指示条 */}
          <div
            className="absolute bottom-0 h-0.5 bg-zinc-900 transition-all duration-300 ease-out"
            style={{ left: indicator.left, width: indicator.width }}
          />
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'settings' && <SettingsForm />}
      </div>
    </div>
  )
}

/** 修改密码 */
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
    <div className="max-w-md mx-auto pt-10 px-6">
      <div className="space-y-5">
        <div>
          <label className="block text-sm text-zinc-500 mb-1.5">旧密码</label>
          <input
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-zinc-300 text-sm outline-none transition-colors focus:border-zinc-500"
          />
        </div>
        <div>
          <label className="block text-sm text-zinc-500 mb-1.5">新密码</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-zinc-300 text-sm outline-none transition-colors focus:border-zinc-500"
          />
        </div>
        <div>
          <label className="block text-sm text-zinc-500 mb-1.5">确认新密码</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-zinc-300 text-sm outline-none transition-colors focus:border-zinc-500"
          />
        </div>

        {message && (
          <p className={`text-sm ${message.type === 'success' ? 'text-emerald-600' : 'text-red-500'}`}>
            {message.text}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !oldPassword || !newPassword || !confirmPassword}
          className="w-full py-2.5 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 disabled:opacity-50 transition-colors"
        >
          {loading ? <LoadingDots size="sm" color="white" /> : '保存密码'}
        </button>
      </div>
    </div>
  )
}
