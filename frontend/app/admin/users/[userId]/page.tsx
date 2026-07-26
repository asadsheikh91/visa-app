'use client'

import { useParams } from 'next/navigation'
import { AdminGate } from '@/components/auth/AdminGate'
import { UserDetail } from '@/components/admin/UserDetail'

export default function AdminUserPage() {
  const params = useParams<{ userId: string }>()
  const userId = Array.isArray(params?.userId) ? params.userId[0] : params?.userId

  return (
    <div className="min-h-screen pt-24">
      <AdminGate>
        {userId ? <UserDetail userId={userId} /> : null}
      </AdminGate>
    </div>
  )
}
