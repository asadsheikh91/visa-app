// Shared display helpers for the dashboard modules — labels, colours, and
// small formatters used by ActiveVisaPlan, ReadinessStatus, VisaFileBuilder,
// and PreviousChecks. Keeping them here avoids drift between modules.

import { COUNTRIES } from '@/lib/countries'
import type { ChecklistStatus, ChecklistPriority } from '@/types/visa'

// ── Country ──────────────────────────────────────────────────────────────────

export function countryName(slug: string | null | undefined): string {
  if (!slug) return '—'
  return COUNTRIES.find(c => c.slug === slug)?.name ?? slug.toUpperCase()
}

export function countryFlag(slug: string | null | undefined): string {
  if (!slug) return '🌐'
  return COUNTRIES.find(c => c.slug === slug)?.flag ?? '🌐'
}

export function countryRoute(slug: string | null | undefined): string {
  if (!slug) return 'Student Visa'
  return COUNTRIES.find(c => c.slug === slug)?.route ?? 'Student Visa'
}

// ── Profile field labels ─────────────────────────────────────────────────────

export const STUDY_LEVEL_LABELS: Record<string, string> = {
  foundation:             'Foundation / Pre-sessional',
  undergraduate:          "Bachelor's",
  postgraduate_taught:    "Master's",
  postgraduate_research:  'MPhil / PhD',
  language_course:        'Language Course',
  professional:           'Professional Course',
}

export const ADMISSION_LABELS: Record<string, string> = {
  unconditional_offer: 'Unconditional offer',
  conditional_offer:   'Conditional offer',
  applied_waiting:     'Applied — awaiting decision',
  not_applied_yet:     'Not applied yet',
  exploring:           'Still exploring',
}

export const FUNDING_LABELS: Record<string, string> = {
  self_funded:        'Self-funded',
  family_sponsored:   'Family sponsored',
  employer_sponsored: 'Employer sponsored',
  scholarship:        'Scholarship',
  education_loan:     'Education loan',
  mixed:              'Mixed funding',
}

export const SPONSOR_LABELS: Record<string, string> = {
  parent:   'Parent sponsor',
  spouse:   'Spouse / partner sponsor',
  sibling:  'Sibling sponsor',
  relative: 'Relative sponsor',
  employer: 'Employer sponsor',
}

/** Turns a snake_case value (e.g. "sep_2026") into a Title-Cased label. */
export function humanize(value: string | null | undefined): string {
  if (!value) return '—'
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

// ── Checklist status ─────────────────────────────────────────────────────────

export const STATUS_LABELS: Record<ChecklistStatus, string> = {
  missing:        'Missing',
  in_progress:    'In Progress',
  available:      'Available',
  not_applicable: 'Not Applicable',
  needs_review:   'Needs Review',
}

export const STATUS_ORDER: ChecklistStatus[] = [
  'missing',
  'in_progress',
  'available',
  'not_applicable',
  'needs_review',
]

/** Pill/border classes for a status chip ("Official Document" paper tones).
    Only genuine attention states (missing / critical) spend the orange seal
    budget; positive = stamp green; everything else stays quiet ink/support. */
export const STATUS_CLASSES: Record<ChecklistStatus, string> = {
  missing:        'text-seal-text bg-seal/[0.06] border-seal-text/40',
  in_progress:    'text-support bg-paper-deep border-hairline',
  available:      'text-stamp bg-stamp/[0.06] border-stamp/40',
  not_applicable: 'text-support bg-paper-deep border-hairline',
  needs_review:   'text-ink bg-white border-hairline',
}

/** A small dot colour for a status, used in the select trigger. */
export const STATUS_DOT: Record<ChecklistStatus, string> = {
  missing:        'bg-seal-text',
  in_progress:    'bg-support',
  available:      'bg-stamp',
  not_applicable: 'bg-support',
  needs_review:   'bg-ink',
}

// ── Checklist priority ───────────────────────────────────────────────────────

export const PRIORITY_LABELS: Record<ChecklistPriority, string> = {
  critical: 'Critical',
  high:     'High',
  standard: 'Standard',
}

export const PRIORITY_CLASSES: Record<ChecklistPriority, string> = {
  critical: 'text-seal-text bg-seal/[0.06] border-seal-text/40',
  high:     'text-ink bg-paper-deep border-hairline',
  standard: 'text-support bg-paper-deep border-hairline',
}

// ── Date ─────────────────────────────────────────────────────────────────────

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  } catch {
    return iso
  }
}
