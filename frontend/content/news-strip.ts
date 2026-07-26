// News strip (above the nav) — content lives here, not in JSX, so it can be
// swapped quarterly without touching the component. Update `percentage` and
// `updatedContext` together when a fresher refusal-rate figure is published.

export const NEWS_STRIP = {
  /** Full desktop copy, monospace/uppercase in the component. */
  text: 'PAKISTANI STUDENT VISA REFUSAL RATE HIT 41% LAST INTAKE. NINE UK UNIVERSITIES HAVE PAUSED PAKISTANI APPLICATIONS.',
  /** Truncated copy for narrow viewports (component appends the link after this). */
  mobileText: 'REFUSAL RATE HIT 41% LAST INTAKE.',
  linkLabel: 'WHAT CHANGED',
  linkHref: '/why-visas-fail',
  /** The headline figure, called out separately so it can be audited independently of the sentence. */
  percentage: 41,
  /** Dismissal persistence — cookie (not localStorage) so it also survives across subdomains/SSR checks. */
  cookieName: 'pv_news_dismissed',
  cookieDays: 30,
} as const
