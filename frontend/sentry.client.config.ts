// Browser runtime. Loaded by @sentry/nextjs via the webpack plugin in
// next.config.js. Catches the errors app/error.tsx currently swallows.
import * as Sentry from '@sentry/nextjs'

import { SHARED_OPTIONS } from '@/lib/sentry-shared'

Sentry.init({
  ...SHARED_OPTIONS,
  // Session Replay is deliberately not enabled: it records the DOM, and this
  // app's DOM contains the applicant's answers as they type them.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
})
