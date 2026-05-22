/**
 * 三点加载动画组件
 *
 * 用法：
 *   <LoadingDots label="正在加载..." />
 *   <LoadingDots color="zinc" size="sm" />
 *   <LoadingDots color="indigo" className="py-20" />
 */

const dotSizes = { sm: 'w-2 h-2', md: 'w-2.5 h-2.5', lg: 'w-3 h-3' }
const dotColors = {
  indigo: 'bg-indigo-400',
  zinc: 'bg-zinc-400',
  white: 'bg-white',
}

import type { ReactNode } from 'react'

interface LoadingDotsProps {
  size?: keyof typeof dotSizes
  color?: keyof typeof dotColors
  label?: ReactNode
  className?: string
}

export function LoadingDots({
  size = 'md',
  color = 'indigo',
  label,
  className = '',
}: LoadingDotsProps) {
  const dotClass = `${dotSizes[size]} ${dotColors[color]} rounded-full animate-bounce`

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <span className={`inline-flex gap-1.5 ${label ? 'mb-3' : ''}`}>
        <span className={dotClass} style={{ animationDelay: '0ms' }} />
        <span className={dotClass} style={{ animationDelay: '150ms' }} />
        <span className={dotClass} style={{ animationDelay: '300ms' }} />
      </span>
      {label && <p className="text-zinc-400 text-sm">{label}</p>}
    </div>
  )
}
