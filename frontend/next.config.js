const { withSentryConfig } = require('@sentry/nextjs')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  },
  webpack: (config, { webpack, isServer }) => {
    // Tree-shake the Sentry subsystems this app does not use. Tracing is off
    // (tracesSampleRate: 0) and Session Replay is off deliberately -- it records
    // the DOM, and this DOM holds the applicant's answers as they type. Without
    // these flags their code still ships to every visitor.
    if (!isServer) {
      config.plugins.push(
        new webpack.DefinePlugin({
          __SENTRY_DEBUG__: false,
          __SENTRY_TRACING__: false,
          __RRWEB_EXCLUDE_IFRAME__: true,
          __RRWEB_EXCLUDE_SHADOW_DOM__: true,
          __SENTRY_EXCLUDE_REPLAY_WORKER__: true,
        })
      )
    }
    return config
  },
}

/**
 * Sentry's build-time plugin. It reads sentry.{client,server,edge}.config.ts and
 * injects them into the right runtimes.
 *
 * Source map upload is DISABLED. Uploading needs a SENTRY_AUTH_TOKEN, and a build
 * that fails when a telemetry token is missing or expired is a build that can
 * block a deploy for a reason unrelated to the application. Stack traces stay
 * readable via the bundled maps; turn this on deliberately, with the token set in
 * Vercel, if minified frames become a problem in practice.
 *
 * `silent` keeps the plugin's banner out of the build log, and the wrapper is a
 * no-op at runtime when NEXT_PUBLIC_SENTRY_DSN is unset — see lib/sentry-shared.ts.
 */
module.exports = withSentryConfig(nextConfig, {
  silent: true,
  sourcemaps: { disable: true },
  // Suppresses the plugin's telemetry ping to Sentry during builds.
  telemetry: false,
})
