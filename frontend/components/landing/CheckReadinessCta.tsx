import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

// Shared section-ending call to action used across the landing sections so the
// wording and styling stay consistent. Defaults link to the country picker;
// pass href/label to make it country-specific.
interface Props {
  href?: string
  label?: string
  className?: string
}

export function CheckReadinessCta({
  href = '/tools/student-visa/countries',
  label = 'Check Your Visa Readiness',
  className = '',
}: Props) {
  return (
    <div className={`flex justify-center ${className}`}>
      <Link href={href} className="btn-primary hover-glow">
        {label}
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </div>
  )
}
