import { AuthRetryableFetchError } from '@supabase/auth-js'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { NATIVE_AUTH_REDIRECT } from './flow'
import { createAuthOperations } from './operations'

const SESSION = { access_token: 'session-token' } as Session

function authClient() {
  const auth = {
    signInWithOtp: vi.fn(),
    verifyOtp: vi.fn(),
    signInWithOAuth: vi.fn(),
    exchangeCodeForSession: vi.fn(),
  }
  return { auth, client: { auth } as unknown as SupabaseClient }
}

describe('Supabase authentication operations', () => {
  it('requests a six-digit email code with account creation enabled', async () => {
    const { auth, client } = authClient()
    auth.signInWithOtp.mockResolvedValue({ data: { user: null, session: null }, error: null })

    const result = await createAuthOperations(client).requestEmailCode('person@example.com')

    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'person@example.com',
      options: { shouldCreateUser: true },
    })
    expect(result).toEqual({ ok: true, data: undefined })
  })

  it('reports rate limits without exposing the provider message', async () => {
    const { auth, client } = authClient()
    auth.signInWithOtp.mockResolvedValue({
      data: { user: null, session: null },
      error: { status: 429, message: 'raw provider detail' },
    })

    const result = await createAuthOperations(client).requestEmailCode('person@example.com')

    expect(result).toEqual({
      ok: false,
      issue: { kind: 'rate-limited', message: 'Please wait before trying again.' },
    })
    expect(JSON.stringify(result)).not.toContain('raw provider detail')
  })

  it('reports a rejected authentication fetch as a safe network issue', async () => {
    const { auth, client } = authClient()
    auth.signInWithOtp.mockRejectedValue(new TypeError('fetch rejected with private detail'))

    const result = await createAuthOperations(client).requestEmailCode('person@example.com')

    expect(result).toEqual({
      ok: false,
      issue: { kind: 'network', message: 'Check your connection and try again.' },
    })
  })

  it('reports the Supabase retryable fetch error as a safe network issue', async () => {
    const { auth, client } = authClient()
    auth.signInWithOtp.mockRejectedValue(
      new AuthRetryableFetchError('raw CORS failure detail', 0),
    )

    const result = await createAuthOperations(client).requestEmailCode('person@example.com')

    expect(result).toEqual({
      ok: false,
      issue: { kind: 'network', message: 'Check your connection and try again.' },
    })
    expect(JSON.stringify(result)).not.toContain('raw CORS failure detail')
  })

  it('returns typed failures when each Supabase operation rejects nullish values', async () => {
    const request = authClient()
    request.auth.signInWithOtp.mockRejectedValue(null)
    const verify = authClient()
    verify.auth.verifyOtp.mockRejectedValue(undefined)
    const google = authClient()
    google.auth.signInWithOAuth.mockRejectedValue(null)
    const exchange = authClient()
    exchange.auth.exchangeCodeForSession.mockRejectedValue(undefined)

    const results = await Promise.all([
      createAuthOperations(request.client).requestEmailCode('person@example.com'),
      createAuthOperations(verify.client).verifyEmailCode('person@example.com', '123456'),
      createAuthOperations(google.client).createGoogleAuthorization(NATIVE_AUTH_REDIRECT),
      createAuthOperations(exchange.client).exchangeOAuthCode('once'),
    ])

    expect(results).toEqual([
      { ok: false, issue: { kind: 'provider', message: 'We could not sign you in. Please try again.' } },
      { ok: false, issue: { kind: 'provider', message: 'We could not sign you in. Please try again.' } },
      { ok: false, issue: { kind: 'provider', message: 'We could not sign you in. Please try again.' } },
      { ok: false, issue: { kind: 'provider', message: 'We could not sign you in. Please try again.' } },
    ])
  })

  it('verifies the supplied six-digit email code and returns its session', async () => {
    const { auth, client } = authClient()
    auth.verifyOtp.mockResolvedValue({ data: { user: null, session: SESSION }, error: null })

    const result = await createAuthOperations(client).verifyEmailCode('person@example.com', '123456')

    expect(auth.verifyOtp).toHaveBeenCalledWith({
      email: 'person@example.com',
      token: '123456',
      type: 'email',
    })
    expect(result).toEqual({ ok: true, data: SESSION })
  })

  it('reports an expired code with a safe invalid-code issue', async () => {
    const { auth, client } = authClient()
    auth.verifyOtp.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: 'otp_expired', message: 'raw expired-code detail' },
    })

    const result = await createAuthOperations(client).verifyEmailCode('person@example.com', '123456')

    expect(result).toEqual({
      ok: false,
      issue: { kind: 'invalid-code', message: 'That code is invalid or has expired.' },
    })
    expect(JSON.stringify(result)).not.toContain('raw expired-code detail')
  })

  it('does not report OTP success when Supabase returns no session', async () => {
    const { auth, client } = authClient()
    auth.verifyOtp.mockResolvedValue({ data: { user: null, session: null }, error: null })

    const result = await createAuthOperations(client).verifyEmailCode('person@example.com', '123456')

    expect(result).toEqual({
      ok: false,
      issue: { kind: 'provider', message: 'We could not sign you in. Please try again.' },
    })
  })

  it('creates a Google authorization URL without redirecting in the browser', async () => {
    const { auth, client } = authClient()
    auth.signInWithOAuth.mockResolvedValue({ data: { provider: 'google', url: 'https://accounts.google.test' }, error: null })

    const result = await createAuthOperations(client).createGoogleAuthorization(NATIVE_AUTH_REDIRECT)

    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: NATIVE_AUTH_REDIRECT,
        skipBrowserRedirect: true,
        queryParams: { prompt: 'select_account' },
      },
    })
    expect(result).toEqual({ ok: true, data: { url: 'https://accounts.google.test' } })
  })

  it('does not report Google authorization success without a URL', async () => {
    const { auth, client } = authClient()
    auth.signInWithOAuth.mockResolvedValue({ data: { provider: 'google', url: '' }, error: null })

    const result = await createAuthOperations(client).createGoogleAuthorization(NATIVE_AUTH_REDIRECT)

    expect(result).toEqual({
      ok: false,
      issue: { kind: 'provider', message: 'We could not sign you in. Please try again.' },
    })
  })

  it('exchanges the native callback code and requires a session', async () => {
    const { auth, client } = authClient()
    auth.exchangeCodeForSession.mockResolvedValue({ data: { user: null, session: SESSION }, error: null })

    const result = await createAuthOperations(client).exchangeOAuthCode('once')

    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('once')
    expect(result).toEqual({ ok: true, data: SESSION })
  })

  it('does not report an OAuth exchange as successful without a session', async () => {
    const { auth, client } = authClient()
    auth.exchangeCodeForSession.mockResolvedValue({ data: { user: null, session: null }, error: null })

    const result = await createAuthOperations(client).exchangeOAuthCode('once')

    expect(result).toEqual({
      ok: false,
      issue: { kind: 'provider', message: 'We could not sign you in. Please try again.' },
    })
  })
})
