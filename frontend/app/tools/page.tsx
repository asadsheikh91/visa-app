import { Metadata } from 'next'
import { ToolsSection } from '@/components/sections/ToolsSection'

export const metadata: Metadata = {
  title: 'Tools — ParchiVisa',
  description: 'Visa readiness tools by category — start with the Student Visa Readiness Checker for the UK, USA, Canada, and Australia.',
}

export default function ToolsPage() {
  return (
    <div className="min-h-screen pt-16">
      <ToolsSection />
    </div>
  )
}
