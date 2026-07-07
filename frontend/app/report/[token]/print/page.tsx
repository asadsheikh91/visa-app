'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useReportApi } from '@/lib/useReportApi'
import { fetchReportForRender } from '@/lib/api'
import type { ReportData } from '@/types/report'
import { ReportDocument } from '@/components/report/ReportDocument'
import { ReportStatus } from '@/components/report/ReportStatus'
import { HideAppChrome } from '@/components/report/HideAppChrome'

/**
 * Print-optimized report route. No app chrome, no toolbar — this is the single
 * template's print surface, which the backend's Playwright step renders to PDF.
 * `data-report-ready` is set on <body> once the report has painted so Playwright
 * can wait for a deterministic signal before capturing.
 */
export default function ReportPrintPage() {
  const { token } = useParams<{ token: string }>()
  const api = useReportApi()

  const [data, setData] = useState<ReportData | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    // When Playwright loads this route it appends ?rt=<render token>; use the
    // Clerk-free render endpoint in that case. A human viewing it uses their session.
    const rt = new URLSearchParams(window.location.search).get('rt')
    const load = rt ? fetchReportForRender(token, rt) : api.getReport(token)
    load
      .then((d) => active && setData(d))
      .catch(() => active && setFailed(true))
    return () => {
      active = false
    }
  }, [api, token])

  // Signal readiness to Playwright ONLY after the report has data AND the display
  // fonts have settled — so the PDF captures with the intended typefaces. The wait
  // is bounded (fonts.ready resolves even when a webfont fails; the 2.5s race is a
  // hard ceiling) so a slow/blocked font CDN can never stall the capture.
  useEffect(() => {
    if (!data) return
    let cancelled = false
    const markReady = () => {
      if (!cancelled) document.body.setAttribute('data-report-ready', '1')
    }
    const fontsReady =
      (document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts?.ready ??
      Promise.resolve()
    const ceiling = new Promise<void>((resolve) => setTimeout(resolve, 2500))
    Promise.race([fontsReady, ceiling]).then(markReady)
    return () => {
      cancelled = true
      document.body.removeAttribute('data-report-ready')
    }
  }, [data])

  return (
    <>
      <HideAppChrome />
      {failed ? (
        <ReportStatus title="Report unavailable" />
      ) : data ? (
        <ReportDocument data={data} />
      ) : (
        <ReportStatus title="Loading…" />
      )}
    </>
  )
}
