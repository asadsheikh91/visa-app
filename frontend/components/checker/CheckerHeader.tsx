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
    <div className="border-b border-hairline bg-paper">
      <div className="mx-auto max-w-4xl px-gutter py-10">
        <Link
          href={backHref}
          className="mb-6 inline-flex items-center gap-2 font-body text-sm text-support transition-colors hover:text-ink"
        >
          <ArrowLeft size={14} />
          {backLabel}
        </Link>
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[4px] border border-hairline bg-white">
            <GraduationCap size={22} className="text-stamp" />
          </div>
          <div>
            <h1 className="font-serif text-[28px] leading-tight tracking-[-0.01em] text-ink sm:text-[34px]">
              {title}
            </h1>
            <p className="mt-1 font-body text-sm text-support">{subtitle}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
