'use client'

import { useCallback, useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import {
  RefreshCw,
  LayoutDashboard,
  Gauge,
  ListChecks,
  CalendarClock,
  ShieldCheck,
  Users,
  FolderCheck,
  FileStack,
  Sparkles,
  History,
  ArrowRight,
} from 'lucide-react'
import Link from 'next/link'
import { AuthGate } from '@/components/auth/AuthGate'
import { ProfileGate } from '@/components/auth/ProfileGate'
import { DashboardSidebar, type DashboardNavItem } from '@/components/dashboard/DashboardSidebar'
import { KpiOverview } from '@/components/dashboard/KpiOverview'
import { ActiveVisaPlan } from '@/components/dashboard/ActiveVisaPlan'
import { ReadinessStatus } from '@/components/dashboard/ReadinessStatus'
import { ActionPlan } from '@/components/dashboard/ActionPlan'
import { TimelineCard } from '@/components/dashboard/TimelineCard'
import { AiToolsSection } from '@/components/dashboard/AiToolsSection'
import { OutcomePrompt } from '@/components/dashboard/OutcomePrompt'
import { JourneyProgress } from '@/components/dashboard/JourneyProgress'
import { InvitationsBanner } from '@/components/dashboard/InvitationsBanner'
import { FinancialProofChecker } from '@/components/dashboard/FinancialProofChecker'
import { SponsorEvidenceModule } from '@/components/dashboard/SponsorEvidenceModule'
import { VisaFileBuilder } from '@/components/dashboard/VisaFileBuilder'
import { PreviousChecks } from '@/components/dashboard/PreviousChecks'
import { useVisaApi } from '@/lib/useVisaApi'
import { useVisaFileApi } from '@/lib/useVisaFileApi'
import { ApiError } from '@/lib/api'
import type { HistoryItem, UserProfile, VisaFile, ChecklistStatus } from '@/types/visa'

type Section =
  | 'overview' | 'readiness' | 'action_plan' | 'visa_file'
  | 'financial' | 'sponsor' | 'timeline' | 'documents' | 'ai_tools' | 'history'

// ---------------------------------------------------------------------------
// DashboardContent — sidebar shell + per-section content
// ---------------------------------------------------------------------------

function DashboardContent({ profile }: { profile: UserProfile }) {
  const { user } = useUser()
  const api = useVisaApi()
  const fileApi = useVisaFileApi()
  const name = profile.preferred_name || user?.firstName || 'there'

  const [section, setSection] = useState<Section>('overview')

  // ── History (drives Readiness, the builder, and Previous Checks) ──────────
  const [checks, setChecks] = useState<HistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    setHistoryError(null)
    try {
      const data = await api.getHistory()
      const list = Array.isArray(data) ? data : []
      setChecks(list)
      setSelectedCheckId(prev => prev ?? (list[0]?.id ?? null))
    } catch (e) {
      setHistoryError(
        e instanceof ApiError ? e.message : 'Failed to load your history. Please try again.'
      )
      setChecks([])
    } finally {
      setHistoryLoading(false)
    }
  }, [api])

  useEffect(() => { loadHistory() }, [loadHistory])

  // ── Visa file ─────────────────────────────────────────────────────────────
  const [selectedCheckId, setSelectedCheckId] = useState<string | null>(null)
  const [file, setFile] = useState<VisaFile | null>(null)
  const [fileLoading, setFileLoading] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [savingItemId, setSavingItemId] = useState<string | null>(null)
  const [fileNonce, setFileNonce] = useState(0)

  useEffect(() => {
    if (!selectedCheckId) return
    let cancelled = false
    setFileLoading(true)
    setFileError(null)
    fileApi
      .generateFile(selectedCheckId)
      .then(f => { if (!cancelled) setFile(f) })
      .catch(e => {
        if (!cancelled) {
          setFileError(
            e instanceof ApiError ? e.message : 'Could not build your visa file. Please try again.'
          )
        }
      })
      .finally(() => { if (!cancelled) setFileLoading(false) })
    return () => { cancelled = true }
  }, [selectedCheckId, fileNonce, fileApi])

  // ── Status edit (optimistic, reconciled with the server response) ─────────
  const onStatusChange = useCallback(
    async (itemId: string, status: ChecklistStatus) => {
      if (!file) return
      const previous = file
      setSavingItemId(itemId)
      setFile({
        ...file,
        items: file.items.map(it => (it.id === itemId ? { ...it, status } : it)),
      })
      try {
        const updated = await fileApi.updateItemStatus(file.id, itemId, status)
        setFile(updated)
      } catch {
        setFile(previous)
      } finally {
        setSavingItemId(null)
      }
    },
    [file, fileApi]
  )

  // Build the file from a check, then jump to the Visa file section.
  const onBuildFile = useCallback((checkId: string) => {
    setSelectedCheckId(checkId)
    setSection('visa_file')
  }, [])

  // ── Derived ────────────────────────────────────────────────────────────────
  const latestCheck = checks[0] ?? null
  const hasCheck = checks.length > 0
  const builderLocked = !historyLoading && !hasCheck
  const builderLoading = historyLoading || (hasCheck && fileLoading)
  const showSponsorModule = ['family_sponsored', 'mixed'].includes(profile.funding_source ?? '')

  // ── Section navigation model ─────────────────────────────────────────────────
  const navItems: DashboardNavItem[] = [
    { id: 'overview',    label: 'Overview',         icon: LayoutDashboard },
    { id: 'readiness',   label: 'Readiness',        icon: Gauge },
    { id: 'action_plan', label: 'Action plan',      icon: ListChecks },
    { id: 'visa_file',   label: 'Visa file',        icon: FolderCheck },
    { id: 'financial',   label: 'Financial proof',  icon: ShieldCheck },
    ...(showSponsorModule
      ? [{ id: 'sponsor', label: 'Sponsor evidence', icon: Users } as DashboardNavItem]
      : []),
    { id: 'timeline',    label: 'Deadline planner', icon: CalendarClock },
    { id: 'documents',   label: 'Document guide',   icon: FileStack },
    { id: 'ai_tools',    label: 'AI coaching',      icon: Sparkles },
    { id: 'history',     label: 'Previous checks',  icon: History },
  ]

  const SECTION_TITLES: Record<Section, string> = {
    overview:    'Overview',
    readiness:   'Readiness status',
    action_plan: 'Action plan',
    visa_file:   'Visa file',
    financial:   'Financial proof',
    sponsor:     'Sponsor evidence',
    timeline:    'Deadline planner',
    documents:   'Document guide',
    ai_tools:    'AI coaching tools',
    history:     'Previous checks',
  }

  function renderSection() {
    switch (section) {
      case 'overview':
        return (
          <div className="space-y-6">
            <InvitationsBanner />
            <OutcomePrompt />
            <JourneyProgress onNavigateSection={(s) => setSection(s as Section)} />
            <KpiOverview
              latestCheck={latestCheck}
              file={file}
              loading={historyLoading}
              onNavigate={(s) => setSection(s as Section)}
            />
            <ActiveVisaPlan profile={profile} hasCheck={hasCheck} onContinue={() => setSection('visa_file')} />
          </div>
        )
      case 'readiness':
        return <ReadinessStatus latestCheck={latestCheck} onBuildFile={onBuildFile} building={fileLoading} />
      case 'action_plan':
        return <ActionPlan checkId={selectedCheckId ?? latestCheck?.id ?? null} />
      case 'visa_file':
        return (
          <VisaFileBuilder
            file={file}
            loading={builderLoading}
            error={fileError}
            locked={builderLocked}
            savingItemId={savingItemId}
            onRetry={() => setFileNonce(n => n + 1)}
            onStatusChange={onStatusChange}
          />
        )
      case 'financial':
        return <FinancialProofChecker file={file} locked={builderLocked} onFileUpdate={setFile} />
      case 'sponsor':
        return (
          <SponsorEvidenceModule
            file={file}
            locked={builderLocked}
            defaultRelationship={profile.sponsor_relationship}
            onFileUpdate={setFile}
          />
        )
      case 'timeline':
        return <TimelineCard />
      case 'documents':
        return (
          <section className="rounded-[4px] border border-hairline bg-white p-5 shadow-[6px_6px_0_0] shadow-ink/10 sm:p-6">
            <div className="mb-3 flex items-center gap-2">
              <FileStack size={16} className="text-stamp" />
              <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink">Document guide</h2>
            </div>
            <p className="mb-1 font-body text-sm text-support">
              Get the exact documents you need — in order, from the official source, with the
              legal fast-track for each.
            </p>
            <p className="mb-4 font-body text-xs text-support">No agents, no shortcuts — just the official path.</p>
            <Link href="/tools/document-guide" className="btn-primary text-sm">
              Map my documents <ArrowRight size={14} />
            </Link>
          </section>
        )
      case 'ai_tools':
        return <AiToolsSection />
      case 'history':
        return (
          <PreviousChecks
            checks={checks}
            loading={historyLoading}
            error={historyError}
            onRetry={loadHistory}
            onBuildFile={onBuildFile}
            activeCheckId={selectedCheckId}
            building={fileLoading}
          />
        )
    }
  }

  return (
    <div className="mx-auto max-w-content px-gutter py-10">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4 border-b border-hairline pb-6">
        <div>
          <h1 className="font-serif text-[30px] leading-tight tracking-[-0.01em] text-ink sm:text-[36px]">Welcome back, {name}.</h1>
          <p className="mt-2 font-body text-[15px] text-support">Every fixable risk in your application, in one place — let&apos;s close the gaps.</p>
        </div>
        {!historyLoading && (
          <button
            onClick={loadHistory}
            className="flex-shrink-0 rounded-[3px] p-2 text-support transition-colors hover:bg-white hover:text-ink"
            aria-label="Refresh dashboard"
          >
            <RefreshCw size={16} />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Sidebar */}
        <aside className="flex-shrink-0 lg:w-56">
          <DashboardSidebar
            items={navItems}
            active={section}
            onSelect={(id) => setSection(id as Section)}
          />
        </aside>

        {/* Main content */}
        <main className="min-w-0 flex-1">
          <h2 className="mb-4 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-support lg:hidden">
            {SECTION_TITLES[section]}
          </h2>
          {renderSection()}
        </main>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page — auth + profile gates, then the dashboard
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  return (
    <div className="min-h-screen pt-24">
      <AuthGate>
        <ProfileGate>
          {(profile) => <DashboardContent profile={profile} />}
        </ProfileGate>
      </AuthGate>
    </div>
  )
}
