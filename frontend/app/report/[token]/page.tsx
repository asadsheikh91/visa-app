'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Download, Loader2 } from 'lucide-react'
import { useReportApi } from '@/lib/useReportApi'
import { ApiError } from '@/lib/api'
import type { ReportData } from '@/types/report'
import { ReportDocument } from '@/components/report/ReportDocument'
import { ReportStatus } from '@/components/report/ReportStatus'
import styles from '@/components/report/report.module.css'

function messageFor(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 404) return 'This report could not be found.'
    if (err.status === 403) return 'A paid plan is required to view this report.'
    if (err.status === 401) return 'Please sign in to view this report.'
    return err.message
  }
  return 'This report could not be displayed. The data failed validation.'
}

export default function ReportPage() {
  const { token } = useParams<{ token: string }>()
  const api = useReportApi()

  const [data, setData] = useState<ReportData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    api
      .getReport(token)
      .then((d) => active && setData(d))
      .catch((e) => active && setError(messageFor(e)))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [api, token])

  const onDownload = useCallback(async () => {
    setDownloading(true)
    setDownloadError(null)
    try {
      const { url } = await api.getPdfUrl(token)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      setDownloadError(
        e instanceof ApiError ? e.message : 'Could not prepare the PDF. Please try again.',
      )
    } finally {
      setDownloading(false)
    }
  }, [api, token])

  if (loading) return <ReportStatus title="Preparing your report…" />
  if (error || !data) return <ReportStatus title="Report unavailable" detail={error ?? undefined} />

  return (
    <>
      <div className={styles.toolbar}>
        {downloadError ? (
          <span style={{ color: 'var(--crit)', alignSelf: 'center', fontSize: 13 }}>
            {downloadError}
          </span>
        ) : null}
        <button className={styles.downloadBtn} onClick={onDownload} disabled={downloading}>
          {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          {downloading ? 'Preparing…' : 'Download PDF'}
        </button>
      </div>
      <ReportDocument data={data} />
    </>
  )
}
