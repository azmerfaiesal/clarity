import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { PluginListenerHandle } from '@capacitor/core'
import type { Session, User } from '@supabase/supabase-js'
import {
  authRedirectUrl,
  isExpectedAuthCallback,
  oauthCodeFromUrl,
  oauthProblemFromUrl,
} from '../auth/flow'
import {
  authOperations,
  safeAuthIssue,
  type AuthIssue,
  type AuthResult,
} from '../auth/operations'
import { supabase } from '../lib/supabase'
import {
  closeNativeAuthBrowser,
  getNativeLaunchUrl,
  launchAuthUrl,
  listenForNativeAuthUrls,
} from '../native/authBrowser'
import { isNativeApp } from '../native/platform'
import { clearNativeReminders } from './notifications'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  oauthCompleting: boolean
  oauthIssue: AuthIssue | null
  requestEmailCode: (email: string) => Promise<AuthResult>
  verifyEmailCode: (email: string, code: string) => Promise<AuthResult<Session>>
  signInWithGoogle: () => Promise<AuthResult>
  clearOauthIssue: () => void
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [oauthCompleting, setOauthCompleting] = useState(false)
  const [oauthIssue, setOauthIssue] = useState<AuthIssue | null>(null)
  const processedCodes = useRef(new Set<string>())

  const consumeCallback = useCallback(async (url: string, native: boolean) => {
    if (!isExpectedAuthCallback(url, native)) return
    if (native) await closeNativeAuthBrowser()

    const problem = oauthProblemFromUrl(url)
    if (problem === 'cancelled') return
    if (problem === 'provider') {
      setOauthIssue({ kind: 'provider', message: 'We could not sign you in. Please try again.' })
      return
    }

    const code = oauthCodeFromUrl(url)
    if (!code || processedCodes.current.has(code)) return

    processedCodes.current.add(code)
    setOauthCompleting(true)
    try {
      const result = await authOperations.exchangeOAuthCode(code)
      if (!result.ok) {
        processedCodes.current.delete(code)
        setOauthIssue(result.issue)
        return
      }

      if (!native) {
        const current = new URL(window.location.href)
        current.searchParams.delete('code')
        current.searchParams.delete('error')
        current.searchParams.delete('error_code')
        current.searchParams.delete('error_description')
        window.history.replaceState(window.history.state, '', `${current.pathname}${current.search}${current.hash}`)
      }
    } finally {
      setOauthCompleting(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    let listener: PluginListenerHandle | null = null

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      if (active) setSession(sess)
    })

    void (async () => {
      if (isNativeApp) {
        const launchUrl = await getNativeLaunchUrl()
        if (launchUrl) await consumeCallback(launchUrl, true)

        const registeredListener = await listenForNativeAuthUrls((url) => consumeCallback(url, true))
        if (active) listener = registeredListener
        else await registeredListener?.remove()
      } else if (isExpectedAuthCallback(window.location.href, false)) {
        await consumeCallback(window.location.href, false)
      }

      const { data } = await supabase.auth.getSession()
      if (active) {
        setSession(data.session)
        setLoading(false)
      }
    })()

    return () => {
      active = false
      sub.subscription.unsubscribe()
      void listener?.remove()
    }
  }, [consumeCallback])

  const requestEmailCode = useCallback(
    (email: string) => authOperations.requestEmailCode(email.trim().toLowerCase()),
    [],
  )

  const verifyEmailCode = useCallback(
    (email: string, code: string) => authOperations.verifyEmailCode(email.trim().toLowerCase(), code),
    [],
  )

  const signInWithGoogle = useCallback(async (): Promise<AuthResult> => {
    setOauthIssue(null)
    const result = await authOperations.createGoogleAuthorization(
      authRedirectUrl(isNativeApp, window.location.href),
    )
    if (!result.ok) return result

    try {
      await launchAuthUrl(result.data.url)
      return { ok: true, data: undefined }
    } catch (error) {
      return { ok: false, issue: safeAuthIssue(error) }
    }
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      user: session?.user ?? null,
      session,
      loading,
      oauthCompleting,
      oauthIssue,
      requestEmailCode,
      verifyEmailCode,
      signInWithGoogle,
      clearOauthIssue: () => setOauthIssue(null),
      signOut: async () => {
        await clearNativeReminders()
        await supabase.auth.signOut()
      },
    }),
    [session, loading, oauthCompleting, oauthIssue, requestEmailCode, verifyEmailCode, signInWithGoogle],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
