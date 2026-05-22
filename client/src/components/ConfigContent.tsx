/**
 * 配置内容 — 嵌入主内容区，导航标签风格
 *
 * 顶部标签：[设置] [提示词] [服务]（扩展预留）
 * 当前实现：设置 → 修改密码
 */
import { useState } from 'react'
import { getToken } from '../lib/auth'
import { LoadingDots } from './LoadingDots'

type Tab = 'settings'

const tabs: { key: Tab; label: string }[] = [
  { key: 'settings', label: '设置' },
]

export function ConfigContent({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<Tab>('settings')

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* 导航标签 */}
      <div className="flex items-center gap-1 px-5 py-3 border-b border-zinc-200 flex-shrink-0 bg-white">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { if (tab.key === activeTab) onClose(); else setActiveTab(tab.key) }}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-indigo-50 text-indigo-700 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 内容 */}
      <div className="flex-1 overflow-y-auto p-6 bg-zinc-50">
        {activeTab === 'settings' && <SettingsForm />}
      </div>
    </div>
  )
}

/** 修改密码表单 */
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
    <div className="max-w-md mx-auto mt-8">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-6 space-y-4">
        <h2 className="text-base font-medium text-zinc-800 mb-1">修改密码</h2>

        <div>
          <label className="block text-sm text-zinc-500 mb-1">旧密码</label>
          <input
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 text-sm outline-none focus:border-indigo-400 transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm text-zinc-500 mb-1">新密码</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 text-sm outline-none focus:border-indigo-400 transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm text-zinc-500 mb-1">确认新密码</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 text-sm outline-none focus:border-indigo-400 transition-colors"
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
          className="w-full py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 disabled:opacity-50 transition-colors"
        >
          {loading ? <LoadingDots size="sm" color="white" /> : '保存密码'}
        </button>
      </form>
    </div>
  )
}
