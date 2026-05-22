/**
 * 登录页
 */
import { useState } from 'react'
import { setToken } from '../lib/auth'
import { LoadingDots } from './LoadingDots'

export function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '登录失败')
        return
      }
      setToken(data.token)
      onLogin()
    } catch {
      setError('网络错误')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-dvh bg-zinc-50 flex items-center justify-center">
      <div className="w-full max-w-sm mx-4">
        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-8">
          <h1 className="text-xl font-semibold text-zinc-800 text-center mb-2">PI WEB</h1>
          <p className="text-sm text-zinc-400 text-center mb-6">请输入密码</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="密码"
              autoFocus
              className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 text-sm outline-none focus:border-indigo-400 transition-colors"
            />
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading || !password}
              className="w-full py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 disabled:opacity-50 transition-colors"
            >
              {loading ? <LoadingDots size="sm" color="white" /> : '登 录'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
