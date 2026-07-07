'use client'

import { useEffect, useState } from 'react'
import { tierFromScore, type ReadinessTier } from '@/types/visa'

// One readiness language, shared verbatim with the comparison pills:
//   high = ready (green) · mid = borderline (amber) · low = high risk (red).
// Colour is derived from the numeric score band, never the backend label —
// so any label the backend returns renders safely.
type ReadinessLevel = 'high' | 'mid' | 'low'

const levelByTier: Record<ReadinessTier, ReadinessLevel> = {
  ready:        'high',
  mostly_ready: 'high',
  needs_work:   'mid',
  not_ready:    'low',
}

const ringStroke: Record<ReadinessLevel, string> = {
  high: 'var(--readiness-high)',
  mid:  'var(--readiness-mid)',
  low:  'var(--readiness-low)',
}

const pillClass: Record<ReadinessLevel, string> = {
  high: 'bg-readiness-high/10 text-readiness-high border-readiness-high/30',
  mid:  'bg-readiness-mid/10 text-readiness-mid border-readiness-mid/30',
  low:  'bg-readiness-low/10 text-readiness-low border-readiness-low/30',
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
  const level = levelByTier[tierFromScore(safeScore)]

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
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" strokeWidth="10"
            style={{ stroke: 'var(--white-6)' }}
          />
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ stroke: ringStroke[level], transition: 'stroke-dasharray 0.05s' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-extrabold text-white">{animatedScore}</span>
          <span className="text-xs text-slate-500 font-medium">/ 100</span>
        </div>
      </div>
      {label && (
        <span className={`rounded-full border px-3 py-1 text-center text-sm font-bold ${pillClass[level]}`}>
          {label}
        </span>
      )}
    </div>
  )
}
