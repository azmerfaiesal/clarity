import { useState, type ReactNode } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { useAuth } from '../store/auth'

/**
 * Dev escape hatch: `VITE_LOCAL_ONLY=1` in .env.local skips the sign-in screen
 * and runs the app against localStorage only, so the UI can be worked on
 * without touching real account data. Dead code in production builds.
 */
const LOCAL_ONLY = import.meta.env.DEV && import.meta.env.VITE_LOCAL_ONLY === '1'

function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading, signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (loading) {
    return (
 <div className="flex min-h-screen items-center justify-center bg-bg text-faint">
 <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (!user && !LOCAL_ONLY) {
    return (
 <div className="flex min-h-screen items-center justify-center bg-bg px-4">
 <div className="w-full max-w-sm lift rounded-xl border border-line bg-raised p-7">
 <div className="mb-5 flex items-center gap-2.5">
 <div className="flex h-8 w-8 items-center justify-center lift rounded-md bg-accent">
 <CheckCircle2 className="h-5 w-5 text-accent-ink" strokeWidth={2.5} />
            </div>
            <div>
 <div className="text-[17px] font-semibold tracking-tight text-ink">
                Clarity
              </div>
 <div className="text-xs text-faint">Sign in to sync across devices</div>
            </div>
          </div>

 <label className="mb-1 block text-[11px] uppercase tracking-wide text-faint">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
 className="mb-3 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
          />

 <label className="mb-1 block text-[11px] uppercase tracking-wide text-faint">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
 className="mb-3 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
          />

 {error && <div className="mb-3 text-xs text-danger">{error}</div>}
 {info && <div className="mb-3 text-xs text-accent">{info}</div>}

          <button
            type="button"
            onClick={submit}
            disabled={busy}
 className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hi disabled:opacity-60"
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
 className="w-full text-center text-xs text-faint hover:text-ink"
          >
            {mode === 'signin'
              ? "No account? Create one"
              : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    )
  }

  // Signed in — the app takes over. Account controls live in Settings.
  return <>{children}</>

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
