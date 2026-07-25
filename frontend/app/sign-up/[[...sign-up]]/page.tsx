import { SignUp } from '@clerk/nextjs'
import { AuthShell } from '@/components/auth/AuthShell'

export const metadata = { title: 'Create account - ParchiVisa' }

export default function SignUpPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-gutter pt-28">
        <p className="font-body text-sm text-support">Authentication is not configured.</p>
      </div>
    )
  }

  return (
    <AuthShell eyebrow="ParchiVisa · Create your account">
      <SignUp signInUrl="/sign-in" fallbackRedirectUrl="/tools/student-visa/countries" />
    </AuthShell>
  )
}
