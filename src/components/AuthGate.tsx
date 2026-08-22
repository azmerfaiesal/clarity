import { useState, type ReactNode } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { useAuth } from '../store/auth'

function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading, signIn, signUp, signOut } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 text-neutral-400 dark:bg-neutral-950">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 dark:bg-neutral-950">
        <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-7 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mb-5 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 shadow-sm">
              <CheckCircle2 className="h-5 w-5 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-[17px] font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
                Clarity
              </div>
              <div className="text-xs text-neutral-400">Sign in to sync across devices</div>
            </div>
          </div>

          <label className="mb-1 block text-[11px] uppercase tracking-wide text-neutral-400">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            className="mb-3 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:ring-indigo-900/40"
          />

          <label className="mb-1 block text-[11px] uppercase tracking-wide text-neutral-400">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            autoComplete="current-password"
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            className="mb-3 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:ring-indigo-900/40"
          />

          {error && <div className="mb-3 text-xs text-red-500">{error}</div>}
          {info && <div className="mb-3 text-xs text-emerald-500">{info}</div>}

          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin')
              setError(null)
              setInfo(null)
            }}
            className="w-full text-center text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
          >
            {mode === 'signin'
              ? "No account? Create one"
              : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen">
      <div className="fixed right-3 top-3 z-40 hidden sm:block">
        <button
          type="button"
          onClick={() => signOut()}
          className="rounded-full border border-neutral-200 bg-white/80 px-3 py-1.5 text-xs text-neutral-500 backdrop-blur transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800/80 dark:hover:bg-neutral-700"
        >
          Sign out
        </button>
      </div>
      {children}
      {/* Sign out also reachable from a small button below for mobile */}
      <div className="fixed bottom-3 right-3 z-40 sm:hidden">
        <button
          type="button"
          onClick={() => signOut()}
          className="rounded-full border border-neutral-200 bg-white/80 px-3 py-1.5 text-xs text-neutral-500 backdrop-blur dark:border-neutral-700 dark:bg-neutral-800/80"
        >
          Sign out
        </button>
      </div>
    </div>
  )

  async function submit() {
    setError(null)
    setInfo(null)
    if (!email.trim() || password.length < 6) {
      setError('Enter a valid email and a password of at least 6 characters.')
      return
    }
    setBusy(true)
    try {
      if (mode === 'signin') {
        const { error } = await signIn(email.trim(), password)
        if (error) setError(error)
      } else {
        const { error, needsConfirm } = await signUp(email.trim(), password)
        if (error) setError(error)
        else if (needsConfirm)
          setInfo('Check your email to confirm your account, then sign in.')
        else setInfo('Account created. You can start using Clarity.')
      }
    } finally {
      setBusy(false)
    }
  }
}

export default AuthGate
