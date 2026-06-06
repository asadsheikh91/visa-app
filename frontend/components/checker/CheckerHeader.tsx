import Link from 'next/link'
import { GraduationCap, ArrowLeft } from 'lucide-react'

interface Props {
  title: string
  subtitle: string
  backHref: string
  backLabel: string
}

export function CheckerHeader({ title, subtitle, backHref, backLabel }: Props) {
  return (
    <div className="relative">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 relative">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 transition-colors mb-6"
        >
          <ArrowLeft size={14} />
          {backLabel}
        </Link>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-600 to-accent-600 flex items-center justify-center shadow-lg shadow-brand-900/40">
            <GraduationCap size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">{title}</h1>
            <p className="text-slate-400 text-sm mt-0.5">{subtitle}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
