"""
services/report_pdf.py

Constraint #6: the PDF is produced SERVER-SIDE by Playwright rendering the print
route — no client-side html2canvas/jsPDF. Print CSS (@page A4, page-break rules)
lives in the frontend's report.module.css; here we just drive the headless browser
and emit A4 pages with backgrounds preserved.

Playwright is imported lazily so `import main` never depends on the browser being
installed. If Playwright (or its Chromium) is missing, render raises PdfRenderError,
which the route maps to 503 — the feature degrades instead of 500-ing.

The sync Playwright API is used; the caller runs it via asyncio.to_thread so it
never blocks the event loop.
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

# Selector the print page sets on <body> once the report has painted — a
# deterministic signal to capture, rather than a fixed sleep.
READY_SELECTOR = "body[data-report-ready]"
_DEFAULT_TIMEOUT_MS = 30_000


class PdfRenderError(Exception):
    """Playwright missing, navigation failed, or the ready signal never arrived."""


def render_report_pdf(
    url: str,
    *,
    ready_selector: str = READY_SELECTOR,
    timeout_ms: int = _DEFAULT_TIMEOUT_MS,
) -> bytes:
    """
    Load `url` (the print route, carrying a single-use render token), wait for the
    report to finish painting, and return the A4 PDF bytes. Raises PdfRenderError on
    any failure so the caller can return 503.
    """
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:  # pragma: no cover - Playwright is in requirements
        raise PdfRenderError("Playwright is not installed.") from exc

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(args=["--no-sandbox", "--disable-dev-shm-usage"])
            try:
                page = browser.new_page()
                # domcontentloaded (NOT networkidle): the print page raises the
                # `data-report-ready` signal only AFTER its data has loaded and
                # document.fonts.ready has settled, so we wait on that deterministic
                # signal instead of network idle. This means a slow/blocked webfont
                # CDN can never hang the capture (fonts.ready settles on failure too).
                page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
                page.wait_for_selector(ready_selector, timeout=timeout_ms)
                pdf = page.pdf(
                    format="A4",
                    print_background=True,
                    prefer_css_page_size=True,
                )
            finally:
                browser.close()
        if not pdf:
            raise PdfRenderError("Playwright produced an empty PDF.")
        return pdf
    except PdfRenderError:
        raise
    except Exception as exc:  # noqa: BLE001 - any failure → 503
        # Never log the URL: it carries a (single-use) render token.
        logger.warning("Report PDF render failed (%s).", type(exc).__name__)
        raise PdfRenderError("Failed to render the report PDF.") from exc
