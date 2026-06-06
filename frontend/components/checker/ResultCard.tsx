import { AlertTriangle, CheckCircle2, Info, ArrowRight, RefreshCw, ShieldAlert } from 'lucide-react'
import { ScoreRing } from './ScoreRing'
import type { CheckResult, ResultIssue } from '@/types/visa'
import Link from 'next/link'
import { SourcesUsedList } from '@/components/checker/SourcesUsedList'

interface Props {
  result: CheckResult
  onRetry: () => void
}

const countryLabels: Record<string, string> = {
  uk: 'United Kingdom',
  usa: 'United States',
  canada: 'Canada',
  australia: 'Australia',
}

function IssueList({ items }: { items: ResultIssue[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={item.question_id || i} className="flex items-start gap-2.5 text-sm">
          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-current flex-shrink-0 opacity-60" />
          <span>{item.message}</span>
        </li>
      ))}
    </ul>
  )
}

export function ResultCard({ result, onRetry }: Props) {
  const countryName  = countryLabels[result.country] || result.country
  const visaTypeLabel = result.visa_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

  const blockers      = result.critical_blockers     ?? []
  const highRiskFlags = result.high_risk_flags        ?? []
  const softWarnings  = result.soft_warnings          ?? []
  const warnings      = result.warnings               ?? []
  const recs          = result.recommendations        ?? []
  const sources        = result.sources_used             ?? []

  return (
    <div className="space-y-6">
      {/* Score header */}
      <div className="glass rounded-2xl p-7 text-center border border-white/10">
        <p className="section-label mb-4">Your Readiness Score</p>
        <ScoreRing score={result.score} label={result.result} size={150} />
        <h3 className="text-xl font-bold text-white mt-5 mb-2">
          {countryName} · {visaTypeLabel}
        </h3>
        <p className="text-slate-400 text-sm max-w-md mx-auto">{result.result_description}</p>
      </div>

      {result.id === null && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={16} className="text-amber-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
            <p className="text-sm text-amber-200">
              Your score was calculated, but it was not saved to your dashboard. Please try again in a moment.
            </p>
          </div>
        </div>
      )}

      {/* Critical blockers */}
      {blockers.length > 0 && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 text-red-200">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-red-400" aria-hidden="true" />
            <h4 className="text-sm font-bold text-red-300">
              Critical Blockers ({blockers.length})
            </h4>
          </div>
          <p className="text-xs text-red-400/70 mb-3">
            These issues will likely cause a visa refusal. Fix them before applying.
          </p>
          <IssueList items={blockers} />
        </div>
      )}

      {/* High-risk flags */}
      {highRiskFlags.length > 0 && (
        <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-5 text-orange-200">
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert size={16} className="text-orange-400" aria-hidden="true" />
            <h4 className="text-sm font-bold text-orange-300">
              High-Risk Flags ({highRiskFlags.length})
            </h4>
          </div>
          <p className="text-xs text-orange-400/70 mb-3">
            These factors increase refusal risk. Resolve them before lodging.
          </p>
          <IssueList items={highRiskFlags} />
        </div>
      )}

      {/* Soft warnings */}
      {softWarnings.length > 0 && (
        <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-5 text-yellow-200">
          <div className="flex items-center gap-2 mb-3">
            <Info size={16} className="text-yellow-400" aria-hidden="true" />
            <h4 className="text-sm font-bold text-yellow-300">
              Advisory Notices ({softWarnings.length})
            </h4>
          </div>
          <IssueList items={softWarnings} />
        </div>
      )}

      {/* Auto-computed per-question warnings */}
      {warnings.length > 0 && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 text-amber-200">
          <div className="flex items-center gap-2 mb-3">
            <Info size={16} className="text-amber-400" aria-hidden="true" />
            <h4 className="text-sm font-bold text-amber-300">
              Warnings ({warnings.length})
            </h4>
          </div>
          <IssueList items={warnings} />
        </div>
      )}

      {/* Recommendations */}
      {recs.length > 0 && (
        <div className="rounded-2xl border border-brand-500/20 bg-brand-500/5 p-5 text-brand-200">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 size={16} className="text-brand-400" aria-hidden="true" />
            <h4 className="text-sm font-bold text-brand-300">
              Recommendations ({recs.length})
            </h4>
          </div>
          <ul className="space-y-2">
            {recs.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-brand-200">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Sources / citations */}
      {sources.length > 0 && (
        <SourcesUsedList sources={sources} />
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button onClick={onRetry} className="btn-secondary flex-1 justify-center">
          <RefreshCw size={15} aria-hidden="true" />
          Retake this check
        </button>
        <Link href="/tools/student-visa/countries" className="btn-primary flex-1 justify-center">
          Check another country
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>

      <p className="text-center text-xs text-slate-700">
        This is an informational readiness check, not legal advice. Requirements may change — always verify with the official visa authority.
      </p>
    </div>
  )
}
