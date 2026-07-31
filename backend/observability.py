"""
observability.py

Error reporting via Sentry. Disabled unless SENTRY_DSN is set, which is what
keeps local development and the test suite from reporting into the production
project — the same fail-quiet posture the Gumroad webhook and the report
narrator use.

WHY THIS EXISTS
Unhandled exceptions previously went to stderr and no further. On the deployed
stack that means a container log nobody is watching: a user hits a 500 at 3am,
sees a broken page, closes the tab, and the failure is never observed. This
module turns that into a push notification with a stack trace.

PII IS THE REASON THIS CONFIG IS NOT THE DEFAULT ONE
An error report is a copy of whatever the server was holding when it failed, and
what this server holds is visa applicants' answers -- nationality, funding
source, previous refusals. Shipping that to a third party because a route
crashed would be a worse breach than the crash.

Four settings prevent it, and none of them should be relaxed without deciding
that deliberately:

  send_default_pii=False        Do not attach user identifiers, cookies or
                                headers. This is the SDK default; it is set
                                explicitly so that a future reader has to make a
                                conscious choice to change it.
  max_request_body_size="never" Never attach request bodies. The readiness check
                                POSTs the applicant's answers, so the body is
                                exactly the data that must not leave.
  include_local_variables=False The one that is easy to miss, and the one that
                                actually leaked in testing. Sentry attaches each
                                stack frame's local variables by default -- and a
                                route handler's parsed request body IS a local.
                                With the other two guards set but this one left
                                at its default, a captured 500 still carried the
                                applicant's nationality, their previous-refusal
                                answer, and a report access token. Turning it off
                                costs variable values in the trace; the frames,
                                line numbers and exception remain.
  before_send                   Redacts URLs. A token in an error report is a
                                live credential sitting in a third-party system,
                                and report tokens reach the server as a PATH
                                segment (/reports/{token}), so dropping query
                                strings is not enough on its own.
"""

import logging
import os
import re

logger = logging.getLogger(__name__)


# Report access tokens travel as a PATH segment (/reports/{token}), not as a
# query parameter -- see routers/report.py. Stripping query strings alone would
# leave a live credential in the reported URL of any failure in that route.
_TOKEN_PATH = re.compile(r"(/reports?/)[^/?#]+", re.IGNORECASE)


def _redact_url(url):
    """Remove the query string and redact report tokens from a URL."""
    if not isinstance(url, str):
        return url
    return _TOKEN_PATH.sub(r"\1[redacted]", url.split("?", 1)[0])


def _scrub(event, hint):
    """
    Drop query strings from every URL in the event -- they can carry report tokens.

    Two places carry them, and the second is easy to overlook:

    `request`     the URL of the failing request itself.

    `breadcrumbs` Sentry records every HTTP call as a breadcrumb, and breadcrumbs
                  from earlier requests ride along on a LATER event -- so a token
                  from one request can surface in the report for an unrelated
                  failure minutes afterwards.

                  Note that the breadcrumb does NOT put the query string in its
                  `url`; it keeps it in a separate `http.query` field. Stripping
                  the URL alone looks correct and removes nothing, which is how
                  this survived the first attempt at the fix.
    """
    try:
        request = event.get("request")
        if request:
            request["url"] = _redact_url(request.get("url"))
            request.pop("query_string", None)

        for crumb in event.get("breadcrumbs", {}).get("values", []) or []:
            data = crumb.get("data")
            if isinstance(data, dict):
                if "url" in data:
                    data["url"] = _redact_url(data["url"])
                data.pop("http.query", None)
                data.pop("http.fragment", None)
    except Exception:  # noqa: BLE001 - scrubbing must never break error reporting
        pass
    return event


def init_sentry() -> bool:
    """
    Initialise Sentry when SENTRY_DSN is configured.

    Returns True when reporting is active, False when it is switched off. Never
    raises: a misconfigured DSN or a missing package must not stop the API from
    booting, because error reporting is diagnostics, not a dependency.
    """
    dsn = os.getenv("SENTRY_DSN", "").strip()
    if not dsn:
        logger.info("SENTRY_DSN not set - error reporting disabled.")
        return False

    try:
        import sentry_sdk
    except ImportError:
        logger.warning("SENTRY_DSN is set but sentry-sdk is not installed.")
        return False

    try:
        sentry_sdk.init(
            dsn=dsn,
            environment=os.getenv("ENVIRONMENT", "development").strip().lower(),
            release=os.getenv("SENTRY_RELEASE") or None,
            # Errors are the point. Performance tracing is sampled at 0 by
            # default so a burst of traffic cannot burn the free-tier quota that
            # the actual crash reports need.
            traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0")),
            # See module docstring - these four are the PII guard. Removing any
            # one of them has been shown to leak applicant data into the report.
            send_default_pii=False,
            max_request_body_size="never",
            include_local_variables=False,
            before_send=_scrub,
        )
    except Exception:  # noqa: BLE001 - never let telemetry setup break startup
        logger.exception("Sentry initialisation failed - continuing without it.")
        return False

    logger.info("Sentry error reporting enabled.")
    return True
