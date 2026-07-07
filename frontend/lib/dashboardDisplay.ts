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

/** Pill/border classes for a status chip. */
export const STATUS_CLASSES: Record<ChecklistStatus, string> = {
  missing:        'text-red-300 bg-red-500/10 border-red-500/25',
  in_progress:    'text-amber-300 bg-amber-500/10 border-amber-500/25',
  available:      'text-emerald-300 bg-emerald-500/10 border-emerald-500/25',
  not_applicable: 'text-slate-400 bg-white/5 border-white/10',
  needs_review:   'text-brand-300 bg-brand-500/10 border-brand-500/25',
}

/** A small dot colour for a status, used in the select trigger. */
export const STATUS_DOT: Record<ChecklistStatus, string> = {
  missing:        'bg-red-400',
  in_progress:    'bg-amber-400',
  available:      'bg-emerald-400',
  not_applicable: 'bg-slate-500',
  needs_review:   'bg-brand-400',
}

// ── Checklist priority ───────────────────────────────────────────────────────

export const PRIORITY_LABELS: Record<ChecklistPriority, string> = {
  critical: 'Critical',
  high:     'High',
  standard: 'Standard',
}

export const PRIORITY_CLASSES: Record<ChecklistPriority, string> = {
  critical: 'text-red-300 bg-red-500/10 border-red-500/20',
  high:     'text-amber-300 bg-amber-500/10 border-amber-500/20',
  standard: 'text-slate-400 bg-white/5 border-white/10',
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
