'use client'

import { useEffect, useState } from 'react'
import { tierFromScore, type ReadinessTier } from '@/types/visa'

// Colour comes from the numeric score (tier), never from the backend's free-text
// label — so any label the backend returns renders safely.
const tierConfig: Record<ReadinessTier, { color: string; gradId: string; from: string; to: string }> = {
  ready:        { color: '#10b981', gradId: 'grad-ready',  from: '#10b981', to: '#34d399' },
  mostly_ready: { color: '#673bff', gradId: 'grad-mostly', from: '#673bff', to: '#a13cff' },
  needs_work:   { color: '#f59e0b', gradId: 'grad-needs',  from: '#f59e0b', to: '#ef4444' },
  not_ready:    { color: '#ef4444', gradId: 'grad-not',    from: '#ef4444', to: '#dc2626' },
}

interface Props {
  score: number
  /** Free-text band label from the backend, shown verbatim under the ring. */
  label: string
  size?: number
}

export function ScoreRing({ score, label, size = 140 }: Props) {
  const [animatedScore, setAnimatedScore] = useState(0)
  const safeScore = Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0
  const cfg = tierConfig[tierFromScore(safeScore)]

  const radius = (size - 16) / 2
  const circumference = 2 * Math.PI * radius
  const filled = (animatedScore / 100) * circumference

  useEffect(() => {
    const timer = setTimeout(() => {
      const start = Date.now()
      const duration = 1000
      const animate = () => {
        const elapsed = Date.now() - start
        const progress = Math.min(elapsed / duration, 1)
        const eased = 1 - Math.pow(1 - progress, 3)
        setAnimatedScore(Math.round(safeScore * eased))
        if (progress < 1) requestAnimationFrame(animate)
      }
      requestAnimationFrame(animate)
    }, 200)
    return () => clearTimeout(timer)
  }, [safeScore])

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <defs>
            <linearGradient id={cfg.gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={cfg.from} />
              <stop offset="100%" stopColor={cfg.to} />
            </linearGradient>
          </defs>
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10"
          />
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            stroke={`url(#${cfg.gradId})`}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: 'stroke-dasharray 0.05s' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-extrabold text-white">{animatedScore}</span>
          <span className="text-xs text-slate-500 font-medium">/ 100</span>
        </div>
      </div>
      {label && (
        <span
          className="text-sm font-bold px-3 py-1 rounded-full text-center"
          style={{ color: cfg.color, background: `${cfg.color}22`, border: `1px solid ${cfg.color}44` }}
        >
          {label}
        </span>
      )}
    </div>
  )
}
