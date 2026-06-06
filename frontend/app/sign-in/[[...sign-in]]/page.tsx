import { SignIn } from '@clerk/nextjs'

export const metadata = { title: 'Sign in - ParchiVisa' }

export default function SignInPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 pt-16">
        <p className="text-sm text-slate-400">Authentication is not configured.</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 pb-12 pt-24">
      <SignIn signUpUrl="/sign-up" fallbackRedirectUrl="/tools/student-visa/countries" />
    </div>
  )
}
