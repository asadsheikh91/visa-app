import Link from 'next/link'
import { AlertCircle, ArrowRight, CheckCircle2, FileText } from 'lucide-react'

type Status = 'Good' | 'Needs attention'

const checklist: { label: string; status: Status }[] = [
  { label: 'CAS / Offer Letter', status: 'Good' },
  { label: 'Financial Proof (28-day rule)', status: 'Needs attention' },
  { label: 'English Proficiency (IELTS)', status: 'Good' },
  { label: 'TB Test Certificate', status: 'Needs attention' },
]

export function ReadinessCard() {
  return (
    <article className="glass-strong hover-lift w-full rounded-[24px] border-white/15 p-6 text-left shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-7">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h3 className="text-2xl font-extrabold text-white">UK Student Visa</h3>
          <p className="mt-2 text-base text-slate-300">Student Route (Tier 4)</p>
        </div>

        <div className="-mt-3 flex shrink-0 flex-col items-center gap-2">
          <ScoreRing score={78} />
          <span className="rounded-full bg-[#673BFF]/80 px-3 py-1 text-xs font-bold text-white shadow-lg shadow-[#673BFF]/25">
            Mostly Ready
          </span>
        </div>
      </div>

      <ul className="mt-6 overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
        {checklist.map(({ label, status }) => {
          const isGood = status === 'Good'
          return (
            <li
              key={label}
              className="flex flex-col gap-2 border-b border-white/10 px-5 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="flex items-center gap-5 text-base font-medium text-white">
                {isGood ? (
                  <CheckCircle2 size={20} className="flex-shrink-0 text-[#18F28A]" />
                ) : (
                  <AlertCircle size={20} className="flex-shrink-0 text-[#FF9F1C]" />
                )}
                {label}
              </span>
              <span className={isGood ? 'text-base font-semibold text-[#18F28A]' : 'text-base font-semibold text-[#FF9F1C]'}>
                {status}
              </span>
            </li>
          )
        })}
      </ul>

      <div className="mt-5 flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-center gap-5 text-sm text-white">
          <FileText size={22} className="flex-shrink-0 text-[#A13CFF]" />
          Detailed breakdown with guidance for improvement
        </span>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 whitespace-nowrap text-sm font-semibold text-[#A13CFF] transition-colors hover:text-[#C77BFF]"
        >
          View Full Report
          <ArrowRight size={15} />
        </Link>
      </div>
    </article>
  )
}

function ScoreRing({ score }: { score: number }) {
  const size = 64
  const stroke = 5
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - score / 100)

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs>
          <linearGradient id="scoreRingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#673BFF" />
            <stop offset="55%" stopColor="#A13CFF" />
            <stop offset="100%" stopColor="#FF6A2A" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.10)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#scoreRingGradient)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xl font-extrabold text-white">
        {score}
      </span>
    </div>
  )
}
