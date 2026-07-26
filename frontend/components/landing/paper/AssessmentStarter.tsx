'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { INTAKE_OPTIONS } from '@/lib/intake'

// Values match the slugs the checker already routes on
// (components/checker/CountrySelector.tsx) — selecting a country here skips
// the country-selection step for real, not just cosmetically.
const COUNTRIES = [
  { label: 'United Kingdom', value: 'uk' },
  { label: 'Australia', value: 'australia' },
  { label: 'Canada', value: 'canada' },
  { label: 'United States', value: 'usa' },
]

/**
 * Inline assessment starter (brief section 14). Routes straight into the
 * country's checker page with `?intake=` attached — see CountryChecker for
 * how (and how much) that param is currently consumed.
 */
export function AssessmentStarter({ reduced, delay }: { reduced: boolean; delay: number }) {
  const router = useRouter()
  const [country, setCountry] = useState<string>(COUNTRIES[0].value)
  const [intake, setIntake] = useState<string>(INTAKE_OPTIONS[0].value)

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    router.push(`/tools/student-visa/countries/${country}?intake=${intake}`)
  }

  return (
    <motion.form
      onSubmit={onSubmit}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduced ? { duration: 0.2, delay } : { duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] }
      }
      className="mt-8 flex flex-col flex-wrap items-start gap-x-2.5 gap-y-4 font-body text-[16px] leading-relaxed text-ink sm:flex-row sm:items-baseline"
    >
      <span>I&rsquo;m applying to</span>
      <FieldSelect label="Country" value={country} onChange={setCountry} options={COUNTRIES} />
      <span>for</span>
      <FieldSelect label="Intake" value={intake} onChange={setIntake} options={INTAKE_OPTIONS} />
      <button
        type="submit"
        className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-[3px] bg-stamp px-5 py-2.5 font-body text-sm font-semibold text-paper transition-colors hover:bg-stamp-deep sm:ml-2 sm:mt-0 sm:w-auto"
      >
        Show my risk
        <ArrowRight size={14} aria-hidden="true" />
      </button>
    </motion.form>
  )
}

function FieldSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: readonly { label: string; value: string }[]
}) {
  return (
    <span className="relative inline-flex items-baseline">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-none border-0 border-b border-hairline bg-transparent py-0.5 pl-0.5 pr-5 font-mono text-[15px] text-ink outline-none transition-[border-width,border-color] duration-[180ms] hover:border-stamp focus-visible:border-b-2 focus-visible:border-stamp focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stamp"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-white text-ink">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={13}
        aria-hidden="true"
        className="pointer-events-none absolute bottom-1.5 right-0.5 text-support"
      />
    </span>
  )
}
