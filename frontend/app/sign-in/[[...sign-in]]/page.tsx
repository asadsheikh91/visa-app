import { SignIn } from '@clerk/nextjs'
import { AuthShell } from '@/components/auth/AuthShell'

export const metadata = { title: 'Sign in - ParchiVisa' }

export default function SignInPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-gutter pt-28">
        <p className="font-body text-sm text-support">Authentication is not configured.</p>
      </div>
    )
  }

  return (
    <AuthShell eyebrow="ParchiVisa · Secure sign-in">
      <SignIn signUpUrl="/sign-up" fallbackRedirectUrl="/tools/student-visa/countries" />
    </AuthShell>
  )
}
