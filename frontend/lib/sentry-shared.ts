/**
 * Sentry options shared by the browser, server and edge runtimes.
 *
 * The frontend handles the same applicant data the API does, so the same rule
 * applies: an error report must not become a copy of someone's visa answers.
 *
 * `sendDefaultPii: false` keeps user identifiers, cookies and headers out.
 *
 * `beforeSend` redacts report tokens. Those arrive as a PATH segment
 * (/report/<token>/print), so unlike a query parameter they are part of the URL
 * Sentry reports by default — and a report URL is the only thing standing
 * between a stranger and someone's assessment. The equivalent guard lives in
 * backend/observability.py; if you change one, change both.
 */
import type { ErrorEvent, EventHint } from '@sentry/nextjs'

const TOKEN_PATH = /(\/reports?\/)[^/?#]+/gi

export function redactUrl(url: string | undefined): string | undefined {
  if (typeof url !== 'string') return url
  return url.split('?')[0].replace(TOKEN_PATH, '$1[redacted]')
}

export function beforeSend(event: ErrorEvent, _hint: EventHint): ErrorEvent {
  try {
    if (event.request?.url) event.request.url = redactUrl(event.request.url)
    if (event.request) delete event.request.query_string

    for (const crumb of event.breadcrumbs ?? []) {
      const data = crumb.data as Record<string, unknown> | undefined
      if (!data) continue
      if (typeof data.url === 'string') data.url = redactUrl(data.url)
      delete data['http.query']
    }
  } catch {
    // Scrubbing must never be the reason an error report is lost.
  }
  return event
}

/** Empty string when unset, which is what keeps Sentry inert locally. */
export const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN ?? ''

export const SHARED_OPTIONS = {
  dsn: DSN,
  enabled: Boolean(DSN),
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? 'production',
  // Errors are the point; tracing at 0 protects the free-tier quota that the
  // actual crash reports need. Matches the backend default.
  tracesSampleRate: 0,
  sendDefaultPii: false,
  beforeSend,
}
