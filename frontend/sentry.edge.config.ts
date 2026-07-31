// Edge runtime (middleware.ts runs here).
import * as Sentry from '@sentry/nextjs'

import { SHARED_OPTIONS } from '@/lib/sentry-shared'

Sentry.init(SHARED_OPTIONS)
