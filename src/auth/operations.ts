import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export type AuthIssueKind = 'invalid-code' | 'rate-limited' | 'network' | 'provider'
export type AuthIssue = { kind: AuthIssueKind; message: string }
export type AuthResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; issue: AuthIssue }

export interface AuthOperations {
  requestEmailCode(email: string): Promise<AuthResult>
  verifyEmailCode(email: string, token: string): Promise<AuthResult<Session>>
  createGoogleAuthorization(redirectTo: string): Promise<AuthResult<{ url: string }>>
  exchangeOAuthCode(code: string): Promise<AuthResult<Session>>
}

export function safeAuthIssue(error: unknown): AuthIssue {
  const candidate =
    typeof error === 'object' && error !== null
      ? (error as { code?: string; status?: number; name?: string })
      : undefined
  if (candidate?.status === 429) {
    return { kind: 'rate-limited', message: 'Please wait before trying again.' }
  }
  if (candidate?.code === 'otp_expired') {
    return { kind: 'invalid-code', message: 'That code is invalid or has expired.' }
  }
  if (error instanceof TypeError || candidate?.name === 'AuthRetryableFetchError') {
    return { kind: 'network', message: 'Check your connection and try again.' }
  }
  return { kind: 'provider', message: 'We could not sign you in. Please try again.' }
}

const ok = <T>(data: T): AuthResult<T> => ({ ok: true, data })
const failed = (error: unknown): AuthResult<never> => ({ ok: false, issue: safeAuthIssue(error) })

export function createAuthOperations(client: SupabaseClient): AuthOperations {
  return {
    async requestEmailCode(email) {
      try {
        const { error } = await client.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: true },
        })
        return error ? failed(error) : ok(undefined)
      } catch (error) {
        return failed(error)
      }
    },
    async verifyEmailCode(email, token) {
      try {
        const { data, error } = await client.auth.verifyOtp({ email, token, type: 'email' })
        if (error) return failed(error)
        if (!data.session) return failed(new Error('Session missing after OTP verification'))
        return ok(data.session)
      } catch (error) {
        return failed(error)
      }
    },
    async createGoogleAuthorization(redirectTo) {
      try {
        const { data, error } = await client.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo,
            skipBrowserRedirect: true,
            queryParams: { prompt: 'select_account' },
          },
        })
        if (error) return failed(error)
        if (!data.url) return failed(new Error('Authorization URL missing'))
        return ok({ url: data.url })
      } catch (error) {
        return failed(error)
      }
    },
    async exchangeOAuthCode(code) {
      try {
        const { data, error } = await client.auth.exchangeCodeForSession(code)
        if (error) return failed(error)
        if (!data.session) return failed(new Error('Session missing after OAuth exchange'))
        return ok(data.session)
      } catch (error) {
        return failed(error)
      }
    },
  }
}

export const authOperations = createAuthOperations(supabase)
