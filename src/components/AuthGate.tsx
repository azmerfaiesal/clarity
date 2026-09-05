import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import {
  nativeSelectionHaptic,
  nativeSuccessHaptic,
  nativeWarningHaptic,
} from '../native/platform'
import { useAuth } from '../store/auth'
import { usePresenceValue } from './MotionPresence'
import { OtpInput } from './auth/OtpInput'

type LoginStep = 'email' | 'code'
type PendingAction = 'request-code' | 'verify-code' | 'resend' | 'google' | null

export const EMAIL_OTP_COOLDOWN_SECONDS = 60

function triggerHaptic(effect: () => void): void {
  try {
    effect()
  } catch {
    // Authentication owns the interaction; optional device feedback never does.
  }
}

function AuthGate({ children }: { children: ReactNode }) {
  const {
    user,
    loading,
    oauthCompleting,
    oauthIssue,
    requestEmailCode,
    verifyEmailCode,
    signInWithGoogle,
    clearOauthIssue,
  } = useAuth()
  const [step, setStep] = useState<LoginStep>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [pending, setPending] = useState<PendingAction>(null)
  const [resendIn, setResendIn] = useState(0)
  const [resendDeadline, setResendDeadline] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [freshLoginRequired, setFreshLoginRequired] = useState(false)
  const [oauthCompletionLatched, setOauthCompletionLatched] = useState(false)
  const emailInputRef = useRef<HTMLInputElement>(null)
  const previouslySignedOut = useRef(false)
  const resetLoginState = useCallback(() => {
    setStep('email')
    setEmail('')
    setCode('')
    setPending(null)
    setResendIn(0)
    setResendDeadline(null)
    setError(null)
    setFreshLoginRequired(false)
    setOauthCompletionLatched(false)
  }, [])
  const loginPresence = usePresenceValue(!loading && !user ? 'login' : null, {
    onExited: resetLoginState,
  })
  const presentingFreshLogin = !user && freshLoginRequired
  const presentedStep = presentingFreshLogin ? 'email' : step
  const presentedEmail = presentingFreshLogin ? '' : email
  const presentedCode = presentingFreshLogin ? '' : code
  const presentedResendIn = presentingFreshLogin ? 0 : resendIn
  const presentedError = presentingFreshLogin ? null : error
  const presentOauthCompletion =
    oauthCompleting ||
    (loginPresence?.phase === 'exiting' && oauthCompletionLatched)

  const refreshResendIn = useCallback(() => {
    if (resendDeadline === null) return
    const remaining = Math.max(0, Math.ceil((resendDeadline - Date.now()) / 1_000))
    setResendIn(remaining)
    if (remaining === 0) setResendDeadline(null)
  }, [resendDeadline])

  useEffect(() => {
    if (resendDeadline === null) return
    const interval = window.setInterval(refreshResendIn, 1_000)
    window.addEventListener('focus', refreshResendIn)
    document.addEventListener('visibilitychange', refreshResendIn)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', refreshResendIn)
      document.removeEventListener('visibilitychange', refreshResendIn)
    }
  }, [refreshResendIn, resendDeadline])

  useEffect(() => {
    if (!oauthIssue) return
    // oxlint-disable-next-line react/set-state-in-effect -- Preserve the consumed provider issue after AuthState clears it.
    setError(oauthIssue.message)
    clearOauthIssue()
  }, [clearOauthIssue, oauthIssue])

  useEffect(() => {
    if (!oauthCompleting) return
    // oxlint-disable-next-line react/set-state-in-effect -- Retain callback progress through the presence exit.
    setOauthCompletionLatched(true)
  }, [oauthCompleting])

  useEffect(() => {
    if (!loading && !user && freshLoginRequired) {
      // oxlint-disable-next-line react/set-state-in-effect -- Clear the retained form before a cancelled exit can expose it.
      resetLoginState()
    }
  }, [freshLoginRequired, loading, resetLoginState, user])

  useEffect(() => {
    if (!loading && !user) previouslySignedOut.current = true
    if (user && previouslySignedOut.current) {
      triggerHaptic(nativeSuccessHaptic)
      previouslySignedOut.current = false
      setFreshLoginRequired(true)
    }
  }, [loading, user])

  if (loading) {
    return (
      <div
        className="auth-screen"
        data-motion-state="entered"
        role="status"
        aria-label="Restoring your session"
      >
        <Loader2 className="h-6 w-6 animate-spin text-faint" />
      </div>
    )
  }

  const loginOverlay = loginPresence ? (
    <div className="auth-screen" data-motion-state={loginPresence.phase}>
      <section
        aria-labelledby="auth-heading"
        className="auth-card rounded-2xl border border-line bg-raised p-7 shadow-xl shadow-black/10 dark:shadow-black/40"
        data-auth-step={presentedStep}
        data-invalid={Boolean(presentedError) || undefined}
        data-auth-success={loginPresence.phase === 'exiting' || undefined}
      >
        <header className="mb-6 flex items-center gap-3">
          <div className="auth-mark flex h-10 w-10 items-center justify-center rounded-xl bg-accent shadow-sm">
            <CheckCircle2 className="h-6 w-6 text-accent-ink" strokeWidth={2.5} />
          </div>
          <div>
            <h1 id="auth-heading" className="text-xl font-semibold tracking-tight text-ink">
              Clarity
            </h1>
            <p className="text-sm text-faint">Your calm, focused workspace</p>
          </div>
        </header>

        {presentOauthCompletion ? (
          <div role="status" className="flex min-h-44 items-center justify-center gap-2 text-sm text-ink">
            <Loader2 className="h-5 w-5 animate-spin text-accent" />
            Signing you in…
          </div>
        ) : (
          <div className="auth-step" key={presentedStep}>
            {presentedStep === 'email' ? (
              <>
                <div className="mb-5">
                  <h2 className="text-lg font-semibold text-ink">Welcome</h2>
                  <p className="mt-1 text-sm leading-relaxed text-faint">
                    Sign in to keep your plans securely in sync.
                  </p>
                </div>

                <label htmlFor="auth-email" className="mb-1.5 block text-sm font-medium text-ink">
                  Email
                </label>
                <input
                  ref={emailInputRef}
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={presentedEmail}
                  onChange={(event) => {
                    setEmail(event.currentTarget.value)
                    if (presentedError) setError(null)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void requestCode('request-code')
                  }}
                  placeholder="you@example.com"
                  className="mb-4 w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent-soft disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={pending !== null}
                />

                <button
                  type="button"
                  disabled={pending !== null}
                  onClick={() => void requestCode('request-code')}
                  className="motion-primary motion-interactive flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-ink hover:bg-accent-hi disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pending === 'request-code' && <Loader2 className="h-4 w-4 animate-spin" />}
                  {pending === 'request-code' ? 'Sending code…' : 'Continue'}
                </button>

                <div className="auth-separator my-5 flex items-center gap-3 text-2xs font-medium uppercase tracking-widest text-faint">
                  <span className="h-px flex-1 bg-line" />
                  <span>OR</span>
                  <span className="h-px flex-1 bg-line" />
                </div>

                <button
                  type="button"
                  disabled={pending !== null}
                  onClick={() => void continueWithGoogle()}
                  className="auth-provider-button motion-interactive flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface px-4 py-3 text-sm font-semibold text-ink hover:border-accent hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pending === 'google' && <Loader2 className="h-4 w-4 animate-spin" />}
                  {pending === 'google' ? 'Opening Google…' : 'Continue with Google'}
                </button>
              </>
            ) : (
              <>
                <div className="mb-5">
                  <h2 className="text-lg font-semibold text-ink">Check your email</h2>
                  <p className="mt-1 text-sm leading-relaxed text-faint">
                    Enter the six-digit code sent to {presentedEmail.trim().toLowerCase()}.
                  </p>
                </div>

                <OtpInput
                  value={presentedCode}
                  onChange={(next) => {
                    setCode(next)
                    if (presentedError) setError(null)
                  }}
                  disabled={pending === 'verify-code'}
                  invalid={Boolean(presentedError)}
                  autoFocus
                />

                <button
                  type="button"
                  disabled={pending !== null || presentedCode.length !== 6}
                  onClick={() => void verifyCode()}
                  className="motion-primary motion-interactive mt-5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-ink hover:bg-accent-hi disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pending === 'verify-code' && <Loader2 className="h-4 w-4 animate-spin" />}
                  {pending === 'verify-code' ? 'Verifying…' : 'Verify code'}
                </button>

                <div className="mt-4 flex flex-col items-center gap-2">
                  <button
                    type="button"
                    disabled={pending !== null || presentedResendIn > 0}
                    onClick={() => void requestCode('resend')}
                    className="motion-interactive cursor-pointer rounded-md px-2 py-1 text-sm font-medium text-accent hover:text-accent-hi disabled:cursor-not-allowed disabled:text-faint"
                  >
                    {presentedResendIn > 0 ? `Resend code in ${presentedResendIn}s` : 'Resend code'}
                  </button>
                  <button
                    type="button"
                    disabled={pending !== null}
                    onClick={changeEmail}
                    className="motion-interactive cursor-pointer rounded-md px-2 py-1 text-sm text-faint hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Change email
                  </button>
                </div>
              </>
            )}

            {presentedError && (
              <p role="alert" className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
                {presentedError}
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  ) : null

  if (user) return <>{children}{loginOverlay}</>
  return loginOverlay

  async function requestCode(action: 'request-code' | 'resend') {
    if (pending) return
    clearOauthIssue()

    const validEmail =
      Boolean(email.trim()) &&
      (action === 'resend' || Boolean(emailInputRef.current?.checkValidity()))
    if (!validEmail) {
      setError('Enter a valid email address.')
      emailInputRef.current?.focus()
      return
    }

    setError(null)
    setPending(action)
    triggerHaptic(nativeSelectionHaptic)
    const result = await requestEmailCode(email)
    setPending(null)
    if (!result.ok) {
      setError(result.issue.message)
      return
    }

    setCode('')
    setStep('code')
    setResendDeadline(Date.now() + EMAIL_OTP_COOLDOWN_SECONDS * 1_000)
    setResendIn(EMAIL_OTP_COOLDOWN_SECONDS)
  }

  async function verifyCode() {
    if (pending || code.length !== 6) return
    clearOauthIssue()
    setError(null)
    setPending('verify-code')
    triggerHaptic(nativeSelectionHaptic)
    const result = await verifyEmailCode(email, code)
    setPending(null)
    if (!result.ok) {
      setError(result.issue.message)
      triggerHaptic(nativeWarningHaptic)
    }
  }

  async function continueWithGoogle() {
    if (pending) return
    clearOauthIssue()
    setError(null)
    setPending('google')
    triggerHaptic(nativeSelectionHaptic)
    const result = await signInWithGoogle()
    setPending(null)
    if (!result.ok) setError(result.issue.message)
  }

  function changeEmail() {
    if (pending) return
    clearOauthIssue()
    setError(null)
    setCode('')
    setStep('email')
    triggerHaptic(nativeSelectionHaptic)
  }
}

export default AuthGate
