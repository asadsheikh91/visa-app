'use client'

import { useState, useCallback } from 'react'
import { Check, ChevronRight, ChevronLeft, Loader2, AlertCircle } from 'lucide-react'
import { useProfileApi } from '@/lib/useProfileApi'
import { ApiError } from '@/lib/api'
import { COUNTRIES } from '@/lib/countries'
import type { UserProfile, ProfilePayload } from '@/types/visa'

// ---------------------------------------------------------------------------
// Static option data
// ---------------------------------------------------------------------------

const ORIGIN_COUNTRIES = [
  { value: 'pakistan',     label: 'Pakistan' },
  { value: 'india',        label: 'India' },
  { value: 'bangladesh',   label: 'Bangladesh' },
  { value: 'nigeria',      label: 'Nigeria' },
  { value: 'ghana',        label: 'Ghana' },
  { value: 'philippines',  label: 'Philippines' },
  { value: 'china',        label: 'China' },
  { value: 'nepal',        label: 'Nepal' },
  { value: 'sri_lanka',    label: 'Sri Lanka' },
  { value: 'indonesia',    label: 'Indonesia' },
  { value: 'malaysia',     label: 'Malaysia' },
  { value: 'kenya',        label: 'Kenya' },
  { value: 'zimbabwe',     label: 'Zimbabwe' },
  { value: 'cameroon',     label: 'Cameroon' },
  { value: 'uae',          label: 'United Arab Emirates' },
  { value: 'saudi_arabia', label: 'Saudi Arabia' },
  { value: 'turkey',       label: 'Turkey' },
  { value: 'iran',         label: 'Iran' },
  { value: 'other',        label: 'Other' },
]

const APPLICANT_TYPES = [
  { value: 'first_time',       label: 'First-time applicant' },
  { value: 'reapplication',    label: 'Re-applying after refusal' },
  { value: 'transfer',         label: 'Transferring from another country' },
  { value: 'already_studying', label: 'Already studying, extending' },
]

const STUDY_LEVELS = [
  { value: 'foundation',           label: 'Foundation / Pre-sessional' },
  { value: 'undergraduate',        label: "Bachelor's (Undergraduate)" },
  { value: 'postgraduate_taught',  label: "Master's (Postgraduate Taught)" },
  { value: 'postgraduate_research',label: 'MPhil / PhD (Research)' },
  { value: 'language_course',      label: 'Language Course' },
  { value: 'professional',         label: 'Professional / Short Course' },
]

const INTAKES = [
  { value: 'sep_2025', label: 'September 2025' },
  { value: 'jan_2026', label: 'January 2026' },
  { value: 'sep_2026', label: 'September 2026' },
  { value: 'jan_2027', label: 'January 2027' },
  { value: 'sep_2027', label: 'September 2027' },
  { value: 'exploring', label: 'Still exploring / unsure' },
]

const ADMISSION_STATUSES = [
  { value: 'unconditional_offer', label: 'Unconditional offer received' },
  { value: 'conditional_offer',   label: 'Conditional offer received' },
  { value: 'applied_waiting',     label: 'Applied, awaiting decision' },
  { value: 'not_applied_yet',     label: 'Not applied yet' },
  { value: 'exploring',           label: 'Still exploring options' },
]

const FUNDING_SOURCES = [
  { value: 'self_funded',       label: 'Self-funded / savings' },
  { value: 'family_sponsored',  label: 'Family sponsored' },
  { value: 'employer_sponsored',label: 'Employer sponsored' },
  { value: 'scholarship',       label: 'Scholarship (full or partial)' },
  { value: 'education_loan',    label: 'Education loan' },
  { value: 'mixed',             label: 'Mixed / combination' },
]

const SPONSOR_RELATIONSHIPS = [
  { value: 'parent',   label: 'Parent(s)' },
  { value: 'spouse',   label: 'Spouse / Partner' },
  { value: 'sibling',  label: 'Sibling' },
  { value: 'relative', label: 'Other relative' },
  { value: 'employer', label: 'Employer' },
]

const FUNDS_ARRANGED = [
  { value: 'yes',         label: 'Yes, fully arranged' },
  { value: 'partially',   label: 'Partially arranged' },
  { value: 'in_progress', label: 'Working on it' },
  { value: 'no',          label: 'Not yet started' },
]

const BANK_STATEMENT_STATUS = [
  { value: 'ready',          label: 'Ready (3–6 months)' },
  { value: 'in_progress',    label: 'Gathering statements' },
  { value: 'not_started',    label: 'Not started' },
  { value: 'not_applicable', label: 'Not applicable (scholarship)' },
]

const HELP_NEEDED = [
  { value: 'documents',               label: 'Document preparation' },
  { value: 'proof_of_funds',          label: 'Proof of funds' },
  { value: 'language_test',           label: 'Language test (IELTS/TOEFL)' },
  { value: 'admission_offer',         label: 'Getting an offer letter' },
  { value: 'understanding_requirements', label: 'Understanding requirements' },
  { value: 'interview_prep',          label: 'Interview preparation' },
  { value: 'timeline_planning',       label: 'Timeline & planning' },
  { value: 'understanding_refusal',   label: 'Understanding a past refusal' },
  { value: 'other',                   label: 'Something else' },
]

const STUDY_COUNTRIES = COUNTRIES.map(c => ({ value: c.slug, label: `${c.flag} ${c.name}` }))

const YES_NO = [
  { value: 'yes', label: 'Yes' },
  { value: 'no',  label: 'No' },
]

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FormState = {
  preferred_name:         string
  applying_from_country:  string
  nationality:            string
  applicant_type:         string
  interested_countries:   string[]
  primary_country:        string
  study_level:            string
  intended_intake:        string
  admission_status:       string
  funding_source:         string
  sponsor_relationship:   string
  funds_arranged:         string
  bank_statement_status:  string
  previous_refusal:       string
  study_gap:              string
  dependants:             string
  main_help_needed:       string[]
}

interface Props {
  initialData?: Partial<UserProfile>
  onComplete:   (profile: UserProfile) => void
}

const STEP_TITLES = ['About you', 'Study plans', 'Finances', 'Background']
const TOTAL_STEPS = 4

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function OptionCard({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'relative flex w-full items-center gap-2 rounded-[3px] border px-3.5 py-3 text-left font-body text-sm transition-colors duration-150',
        selected
          ? 'border-stamp bg-stamp/[0.06] text-ink'
          : 'border-hairline bg-white text-support hover:border-support hover:text-ink',
      ].join(' ')}
    >
      {selected && (
        <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-stamp">
          <Check size={10} className="text-white" strokeWidth={3} />
        </span>
      )}
      {!selected && <span className="h-4 w-4 flex-shrink-0 rounded-full border border-support" />}
      <span>{label}</span>
    </button>
  )
}

function Chip({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex items-center gap-1.5 rounded-[3px] border px-3 py-1.5 font-body text-xs transition-colors duration-150',
        selected
          ? 'border-stamp bg-stamp/[0.06] text-ink'
          : 'border-hairline bg-white text-support hover:border-support hover:text-ink',
      ].join(' ')}
    >
      {selected && <Check size={10} strokeWidth={3} />}
      {label}
    </button>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2.5 font-body text-sm font-medium text-ink">{children}</p>
  )
}

function StyledSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full cursor-pointer appearance-none rounded-[3px] border border-hairline bg-white px-4 py-3 font-body text-sm text-ink transition-colors focus:border-stamp focus:outline-none"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => (
          <option key={o.value} value={o.value} className="bg-white text-ink">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronRight size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-support" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main wizard
// ---------------------------------------------------------------------------

export function OnboardingWizard({ initialData, onComplete }: Props) {
  const api = useProfileApi()

  const [form, setForm] = useState<FormState>({
    preferred_name:        initialData?.preferred_name        ?? '',
    applying_from_country: initialData?.applying_from_country ?? '',
    nationality:           initialData?.nationality           ?? '',
    applicant_type:        initialData?.applicant_type        ?? '',
    interested_countries:  initialData?.interested_countries  ?? [],
    primary_country:       initialData?.primary_country       ?? '',
    study_level:           initialData?.study_level           ?? '',
    intended_intake:       initialData?.intended_intake       ?? '',
    admission_status:      initialData?.admission_status      ?? '',
    funding_source:        initialData?.funding_source        ?? '',
    sponsor_relationship:  initialData?.sponsor_relationship  ?? '',
    funds_arranged:        initialData?.funds_arranged        ?? '',
    bank_statement_status: initialData?.bank_statement_status ?? '',
    previous_refusal:      initialData?.previous_refusal      ?? '',
    study_gap:             initialData?.study_gap             ?? '',
    dependants:            initialData?.dependants            ?? '',
    main_help_needed:      initialData?.main_help_needed      ?? [],
  })

  const [step, setStep] = useState(1)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const setField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
    setFieldError(null)
  }, [])

  const toggleMulti = useCallback((key: 'interested_countries' | 'main_help_needed', value: string) => {
    setForm(prev => {
      const arr = prev[key] as string[]
      return {
        ...prev,
        [key]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value],
      }
    })
    setFieldError(null)
  }, [])

  // Step validation
  const validateStep = (): boolean => {
    if (step === 1 && !form.preferred_name.trim()) {
      setFieldError('Please enter your preferred name to continue.')
      return false
    }
    if (step === 2 && !form.primary_country) {
      setFieldError('Please select your primary study destination.')
      return false
    }
    if (step === 3 && !form.funding_source) {
      setFieldError('Please select how you plan to fund your studies.')
      return false
    }
    return true
  }

  const goNext = () => {
    if (!validateStep()) return
    setFieldError(null)
    if (step < TOTAL_STEPS) {
      setStep(s => s + 1)
    } else {
      handleSubmit()
    }
  }

  const goBack = () => {
    setFieldError(null)
    setStep(s => Math.max(1, s - 1))
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setSubmitError(null)

    const payload: ProfilePayload = {
      preferred_name:        form.preferred_name.trim() || undefined,
      applying_from_country: form.applying_from_country || undefined,
      nationality:           form.nationality           || undefined,
      applicant_type:        form.applicant_type        || undefined,
      interested_countries:  form.interested_countries.length ? form.interested_countries : undefined,
      primary_country:       form.primary_country       || undefined,
      study_level:           form.study_level           || undefined,
      intended_intake:       form.intended_intake       || undefined,
      admission_status:      form.admission_status      || undefined,
      funding_source:        form.funding_source        || undefined,
      sponsor_relationship:  form.sponsor_relationship  || undefined,
      funds_arranged:        form.funds_arranged        || undefined,
      bank_statement_status: form.bank_statement_status || undefined,
      previous_refusal:      form.previous_refusal      || undefined,
      study_gap:             form.study_gap             || undefined,
      dependants:            form.dependants            || undefined,
      main_help_needed:      form.main_help_needed.length ? form.main_help_needed : undefined,
      onboarding_completed:  true,
    }

    try {
      const saved = await api.saveProfile(payload)
      onComplete(saved)
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : 'Could not save your profile. Please try again.'
      setSubmitError(msg)
      setSubmitting(false)
    }
  }

  const showSponsor = form.funding_source === 'family_sponsored' || form.funding_source === 'employer_sponsored'

  // ---------------------------------------------------------------------------
  // Step renderers
  // ---------------------------------------------------------------------------

  function renderStep1() {
    return (
      <div className="space-y-5">
        {/* Preferred name */}
        <div>
          <FieldLabel>What should we call you? <span className="text-seal-text">*</span></FieldLabel>
          <input
            type="text"
            value={form.preferred_name}
            onChange={e => setField('preferred_name', e.target.value)}
            placeholder="e.g. Ahmed"
            maxLength={80}
            className="w-full rounded-[3px] border border-hairline bg-white px-4 py-3 font-body text-sm text-ink placeholder-support transition-colors focus:border-stamp focus:outline-none"
          />
        </div>

        {/* Nationality */}
        <div>
          <FieldLabel>What is your nationality?</FieldLabel>
          <StyledSelect
            value={form.nationality}
            onChange={v => setField('nationality', v)}
            options={ORIGIN_COUNTRIES}
            placeholder="Select nationality"
          />
        </div>

        {/* Applying from */}
        <div>
          <FieldLabel>Where are you currently living?</FieldLabel>
          <StyledSelect
            value={form.applying_from_country}
            onChange={v => setField('applying_from_country', v)}
            options={ORIGIN_COUNTRIES}
            placeholder="Select country"
          />
        </div>

        {/* Applicant type */}
        <div>
          <FieldLabel>How would you describe yourself?</FieldLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {APPLICANT_TYPES.map(o => (
              <OptionCard
                key={o.value}
                label={o.label}
                selected={form.applicant_type === o.value}
                onClick={() => setField('applicant_type', o.value)}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  function renderStep2() {
    return (
      <div className="space-y-5">
        {/* Interested countries */}
        <div>
          <FieldLabel>Which countries are you interested in? (pick all that apply)</FieldLabel>
          <div className="grid grid-cols-2 gap-2">
            {STUDY_COUNTRIES.map(o => (
              <OptionCard
                key={o.value}
                label={o.label}
                selected={form.interested_countries.includes(o.value)}
                onClick={() => toggleMulti('interested_countries', o.value)}
              />
            ))}
          </div>
        </div>

        {/* Primary country */}
        <div>
          <FieldLabel>Your main target country <span className="text-seal-text">*</span></FieldLabel>
          <div className="grid grid-cols-2 gap-2">
            {STUDY_COUNTRIES.map(o => (
              <OptionCard
                key={o.value}
                label={o.label}
                selected={form.primary_country === o.value}
                onClick={() => setField('primary_country', o.value)}
              />
            ))}
          </div>
        </div>

        {/* Study level */}
        <div>
          <FieldLabel>What level of study?</FieldLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {STUDY_LEVELS.map(o => (
              <OptionCard
                key={o.value}
                label={o.label}
                selected={form.study_level === o.value}
                onClick={() => setField('study_level', o.value)}
              />
            ))}
          </div>
        </div>

        {/* Intended intake */}
        <div>
          <FieldLabel>When do you plan to start?</FieldLabel>
          <div className="grid grid-cols-2 gap-2">
            {INTAKES.map(o => (
              <OptionCard
                key={o.value}
                label={o.label}
                selected={form.intended_intake === o.value}
                onClick={() => setField('intended_intake', o.value)}
              />
            ))}
          </div>
        </div>

        {/* Admission status */}
        <div>
          <FieldLabel>Where are you with your application?</FieldLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ADMISSION_STATUSES.map(o => (
              <OptionCard
                key={o.value}
                label={o.label}
                selected={form.admission_status === o.value}
                onClick={() => setField('admission_status', o.value)}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  function renderStep3() {
    return (
      <div className="space-y-5">
        {/* Funding source */}
        <div>
          <FieldLabel>How are you funding your studies? <span className="text-seal-text">*</span></FieldLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {FUNDING_SOURCES.map(o => (
              <OptionCard
                key={o.value}
                label={o.label}
                selected={form.funding_source === o.value}
                onClick={() => setField('funding_source', o.value)}
              />
            ))}
          </div>
        </div>

        {/* Sponsor relationship — conditional */}
        {showSponsor && (
          <div>
            <FieldLabel>Who is sponsoring you?</FieldLabel>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SPONSOR_RELATIONSHIPS.map(o => (
                <OptionCard
                  key={o.value}
                  label={o.label}
                  selected={form.sponsor_relationship === o.value}
                  onClick={() => setField('sponsor_relationship', o.value)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Funds arranged */}
        <div>
          <FieldLabel>Have you arranged the required funds?</FieldLabel>
          <div className="grid grid-cols-2 gap-2">
            {FUNDS_ARRANGED.map(o => (
              <OptionCard
                key={o.value}
                label={o.label}
                selected={form.funds_arranged === o.value}
                onClick={() => setField('funds_arranged', o.value)}
              />
            ))}
          </div>
        </div>

        {/* Bank statement status */}
        <div>
          <FieldLabel>What&apos;s the status of your bank statements?</FieldLabel>
          <div className="grid grid-cols-2 gap-2">
            {BANK_STATEMENT_STATUS.map(o => (
              <OptionCard
                key={o.value}
                label={o.label}
                selected={form.bank_statement_status === o.value}
                onClick={() => setField('bank_statement_status', o.value)}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  function renderStep4() {
    return (
      <div className="space-y-5">
        {/* Previous refusal */}
        <div>
          <FieldLabel>Have you had a visa refusal before?</FieldLabel>
          <div className="grid grid-cols-2 gap-2">
            {YES_NO.map(o => (
              <OptionCard
                key={o.value}
                label={o.label}
                selected={form.previous_refusal === o.value}
                onClick={() => setField('previous_refusal', o.value)}
              />
            ))}
          </div>
        </div>

        {/* Study gap */}
        <div>
          <FieldLabel>Do you have a gap in your study history?</FieldLabel>
          <div className="grid grid-cols-2 gap-2">
            {YES_NO.map(o => (
              <OptionCard
                key={o.value}
                label={o.label}
                selected={form.study_gap === o.value}
                onClick={() => setField('study_gap', o.value)}
              />
            ))}
          </div>
        </div>

        {/* Dependants */}
        <div>
          <FieldLabel>Will you be bringing dependants (spouse / children)?</FieldLabel>
          <div className="grid grid-cols-2 gap-2">
            {YES_NO.map(o => (
              <OptionCard
                key={o.value}
                label={o.label}
                selected={form.dependants === o.value}
                onClick={() => setField('dependants', o.value)}
              />
            ))}
          </div>
        </div>

        {/* Main help needed */}
        <div>
          <FieldLabel>What do you need the most help with? (pick all that apply)</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {HELP_NEEDED.map(o => (
              <Chip
                key={o.value}
                label={o.label}
                selected={form.main_help_needed.includes(o.value)}
                onClick={() => toggleMulti('main_help_needed', o.value)}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Step header */}
      <div className="mb-6">
        {/* Progress dots */}
        <div className="mb-4 flex items-center gap-1.5">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div
              key={i}
              className={[
                'h-1 flex-1 rounded-[1px] transition-all duration-300',
                i + 1 <= step ? 'bg-stamp' : 'bg-paper-deep',
              ].join(' ')}
            />
          ))}
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="mb-1 font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] text-stamp">
              Step {step} of {TOTAL_STEPS}
            </p>
            <h2 className="font-serif text-[22px] leading-tight text-ink">{STEP_TITLES[step - 1]}</h2>
          </div>
          <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-support">{step === 1 ? '~2 min total' : ''}</span>
        </div>
      </div>

      {/* Step content */}
      <div className="mb-4 rounded-[4px] border border-hairline bg-white p-6 shadow-[6px_6px_0_0] shadow-ink/10">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}

        {/* Inline field error */}
        {fieldError && (
          <div className="mt-4 flex items-start gap-2 rounded-[3px] border border-seal-text/40 bg-seal/[0.06] p-3">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0 text-seal-text" />
            <p className="font-body text-xs text-seal-text">{fieldError}</p>
          </div>
        )}
      </div>

      {/* Submit error */}
      {submitError && (
        <div className="mb-4 flex items-start gap-2 rounded-[3px] border border-seal-text/40 bg-seal/[0.06] p-3">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0 text-seal-text" />
          <p className="font-body text-xs text-seal-text">{submitError}</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3">
        {step > 1 ? (
          <button
            type="button"
            onClick={goBack}
            disabled={submitting}
            className="btn-secondary px-5 py-2.5 text-sm"
          >
            <ChevronLeft size={14} />
            Back
          </button>
        ) : (
          <div />
        )}

        <button
          type="button"
          onClick={goNext}
          disabled={submitting}
          className="btn-primary ml-auto px-6 py-2.5 text-sm"
        >
          {submitting ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Saving…
            </>
          ) : step === TOTAL_STEPS ? (
            <>
              Complete setup
              <Check size={14} />
            </>
          ) : (
            <>
              Continue
              <ChevronRight size={14} />
            </>
          )}
        </button>
      </div>
    </div>
  )
}
