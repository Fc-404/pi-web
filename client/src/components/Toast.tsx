import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react'
import { Check, X, TriangleAlert, Info } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

interface ToastItem {
  id: number
  message: string
  type: ToastType
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = nextId++
    setToasts(prev => [...prev, { id, message, type }])
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast 容器 */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[300] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// ===== Toast 项 =====

const toastStyles: Record<ToastType, { bg: string; text: string; Icon: typeof Check }> = {
  success: { bg: 'bg-emerald-500', text: 'text-white', Icon: Check },
  error: { bg: 'bg-red-500', text: 'text-white', Icon: X },
  warning: { bg: 'bg-amber-500', text: 'text-white', Icon: TriangleAlert },
  info: { bg: 'bg-white border border-zinc-200', text: 'text-zinc-800', Icon: Info },
}

function ToastItem({ toast, onRemove }: { toast: ToastItem; onRemove: (id: number) => void }) {
  const [visible, setVisible] = useState(false)
  const { bg, text, Icon } = toastStyles[toast.type]

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onRemove(toast.id), 300)
    }, 3000)
    return () => clearTimeout(timer)
  }, [toast.id, onRemove])

  return (
    <div
      className={`pointer-events-auto px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium
                  transition-all duration-300 select-none flex items-center gap-2
                  ${bg} ${text}
                  ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      {toast.message}
    </div>
  )
}
