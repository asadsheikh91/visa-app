// Shared between the hero's inline assessment starter (which writes the
// `?intake=` param) and CountryChecker (which reads it). Single source so the
// value strings can't drift between the two.

export const INTAKE_OPTIONS = [
  { label: 'September 2026', value: '2026-09', isoDate: '2026-09-01' },
  { label: 'January 2027', value: '2027-01', isoDate: '2027-01-01' },
  { label: 'September 2027', value: '2027-09', isoDate: '2027-09-01' },
  { label: 'Not sure yet', value: 'unsure', isoDate: null },
] as const

export type IntakeValue = (typeof INTAKE_OPTIONS)[number]['value']

export function resolveIntake(value: string | null) {
  return INTAKE_OPTIONS.find((o) => o.value === value) ?? null
}
