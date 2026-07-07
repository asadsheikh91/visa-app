// Single source of truth for the supported study destinations.
//
// Every landing section (comparison, rejection reasons, document checklist,
// country CTA) and any future country UI must consume this array so that:
//   - the ORDER is identical everywhere (Australia → Canada → USA → UK), and
//   - the visual identity is identical everywhere (emoji flag + name).
//
// Section-specific content (tuition figures, rejection reasons, document lists)
// lives in each section keyed by `slug`, and is rendered by iterating COUNTRIES
// so it always inherits this canonical order and chrome.
//
// Slugs match the backend country routes — do not rename without the API.

export type CountrySlug = 'australia' | 'canada' | 'usa' | 'uk'

export interface Country {
  slug: CountrySlug
  name: string
  /** Canonical visual treatment: emoji flag. */
  flag: string
  /** Visa route label shown under the country name. */
  route: string
}

export const COUNTRIES: Country[] = [
  { slug: 'australia', name: 'Australia',      flag: '🇦🇺', route: 'Subclass 500' },
  { slug: 'canada',    name: 'Canada',         flag: '🇨🇦', route: 'Study Permit' },
  { slug: 'usa',       name: 'United States',  flag: '🇺🇸', route: 'F-1 Visa' },
  { slug: 'uk',        name: 'United Kingdom', flag: '🇬🇧', route: 'Student Route' },
]
