import { FileCheck2, Globe2, Scale, ShieldCheck } from 'lucide-react'

const items = [
  { icon: Globe2, label: '4 study destinations' },
  { icon: FileCheck2, label: 'Built on official guidance' },
  { icon: ShieldCheck, label: 'Private by design' },
  { icon: Scale, label: 'Informational, not legal advice' },
]

export function TrustStrip() {
  return (
    <section className="relative z-10 px-4" aria-label="ParchiVisa trust signals">
      <div className="mx-auto max-w-5xl">
        <div className="glass rounded-2xl px-5 py-5 shadow-xl shadow-black/20">
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {items.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2.5 text-sm text-slate-300">
                <Icon size={18} className="flex-shrink-0 text-brand-300" />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
