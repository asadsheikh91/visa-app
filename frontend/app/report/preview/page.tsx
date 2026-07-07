import { notFound } from 'next/navigation'
import { ReportDocument } from '@/components/report/ReportDocument'
import { SAMPLE_REPORT } from '@/components/report/sampleReport'

/**
 * DEV-ONLY design preview of the Readiness Report, rendered from mock data so you
 * can eyeball the exact template (and Print → Save as PDF to preview the print CSS)
 * without the backend, Gemini, R2, auth, or a paid plan. Returns 404 in production.
 */
export default function ReportPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <ReportDocument data={SAMPLE_REPORT} />
}
