// @vitest-environment jsdom
// @vitest-environment-options {"url":"http://localhost:5173/"}

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthResult } from '../auth/operations'

const boundary = vi.hoisted(() => {
  let native = false
  let liveHandler: ((url: string) => void | Promise<void>) | undefined
  let authStateHandler: ((event: string, session: unknown) => void) | undefined

  const listener = { remove: vi.fn().mockResolvedValue(undefined) }
  const authOperations = {
    requestEmailCode: vi.fn(),
    verifyEmailCode: vi.fn(),
    createGoogleAuthorization: vi.fn(),
    exchangeOAuthCode: vi.fn(),
  }
  const auth = {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    signOut: vi.fn(),
  }

  return {
    auth,
    authOperations,
    clearNativeReminders: vi.fn(),
    closeNativeAuthBrowser: vi.fn().mockResolvedValue(undefined),
    getNativeLaunchUrl: vi.fn(),
    launchAuthUrl: vi.fn().mockResolvedValue(undefined),
    listenForNativeAuthUrls: vi.fn(async (handler: (url: string) => void | Promise<void>) => {
      liveHandler = handler
      return listener
    }),
    listener,
    native: () => native,
    resetNative: (value = false) => {
      native = value
    },
    setLiveHandler: (handler: (url: string) => void | Promise<void>) => {
      liveHandler = handler
    },
    setAuthStateHandler: (handler: (event: string, session: unknown) => void) => {
      authStateHandler = handler
    },
    emitAuthState: (session: unknown) => {
      authStateHandler?.('TOKEN_REFRESHED', session)
    },
    triggerLiveUrl: async (url: string) => {
      await liveHandler?.(url)
    },
  }
})

vi.mock('../auth/operations', () => ({
  authOperations: boundary.authOperations,
  safeAuthIssue: (error: unknown) =>
    error instanceof TypeError
      ? { kind: 'network', message: 'Check your connection and try again.' }
      : { kind: 'provider', message: 'We could not sign you in. Please try again.' },
}))
vi.mock('../lib/supabase', () => ({ supabase: { auth: boundary.auth } }))
vi.mock('../native/authBrowser', () => ({
  closeNativeAuthBrowser: boundary.closeNativeAuthBrowser,
  getNativeLaunchUrl: boundary.getNativeLaunchUrl,
  launchAuthUrl: boundary.launchAuthUrl,
  listenForNativeAuthUrls: boundary.listenForNativeAuthUrls,
}))
vi.mock('../native/platform', () => ({
  get isNativeApp() {
    return boundary.native()
  },
}))
vi.mock('./notifications', () => ({ clearNativeReminders: boundary.clearNativeReminders }))

import { AuthProvider, useAuth } from './auth'

const SUCCESS: AuthResult = { ok: true, data: undefined }
const SESSION = { access_token: 'session-token', user: { email: 'person@example.com' } } as Session

function Probe() {
  const auth = useAuth()
  const [googleResult, setGoogleResult] = useState('not-started')
  return (
    <>
      <span data-testid="session">{auth.loading ? 'loading' : auth.user?.email ?? 'signed-out'}</span>
      <span data-testid="oauth-completing">{String(auth.oauthCompleting)}</span>
      <span data-testid="oauth-issue">{auth.oauthIssue?.message ?? 'none'}</span>
      <span data-testid="google-result">{googleResult}</span>
      <button onClick={() => void auth.requestEmailCode(' PERSON@EXAMPLE.COM ')}>email</button>
      <button onClick={() => void auth.verifyEmailCode(' PERSON@EXAMPLE.COM ', '123456')}>code</button>
      <button
        onClick={() => void auth.signInWithGoogle().then((result) => setGoogleResult(result.ok ? 'ok' : result.issue.message))}
      >
        google
      </button>
      <button onClick={auth.clearOauthIssue}>clear issue</button>
    </>
  )
}

function renderProvider() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  )
}

async function loaded() {
  await waitFor(() => expect(screen.getByTestId('session').textContent).not.toBe('loading'))
}

beforeEach(() => {
  vi.clearAllMocks()
  boundary.resetNative()
  window.history.replaceState({}, '', '/?view=today')
  boundary.auth.getSession.mockResolvedValue({ data: { session: null } })
  boundary.auth.onAuthStateChange.mockImplementation((handler) => {
    boundary.setAuthStateHandler(handler)
    return { data: { subscription: { unsubscribe: vi.fn() } } }
  })
  boundary.auth.signOut.mockResolvedValue({ error: null })
  boundary.authOperations.requestEmailCode.mockResolvedValue(SUCCESS)
  boundary.authOperations.verifyEmailCode.mockResolvedValue({ ok: true, data: SESSION })
  boundary.authOperations.createGoogleAuthorization.mockResolvedValue({
    ok: true,
    data: { url: 'https://accounts.google.test/authorize?state=private' },
  })
  boundary.authOperations.exchangeOAuthCode.mockResolvedValue({ ok: true, data: SESSION })
  boundary.getNativeLaunchUrl.mockResolvedValue(null)
  boundary.listenForNativeAuthUrls.mockImplementation(async (handler) => {
    boundary.setLiveHandler(handler)
    return boundary.listener
  })
})

describe('AuthProvider', () => {
  it('normalizes email and forwards the OTP request and verification code', async () => {
    renderProvider()
    await loaded()

    fireEvent.click(screen.getByRole('button', { name: 'email' }))
    fireEvent.click(screen.getByRole('button', { name: 'code' }))

    await waitFor(() => {
      expect(boundary.authOperations.requestEmailCode).toHaveBeenCalledWith('person@example.com')
      expect(boundary.authOperations.verifyEmailCode).toHaveBeenCalledWith('person@example.com', '123456')
    })
  })

  it.each([
    [false, 'http://localhost:5173/'],
    [true, 'com.azmerfaiesal.clarity://auth/callback'],
  ])('launches Google using the correct %s redirect destination', async (native, redirectTo) => {
    boundary.resetNative(native)
    renderProvider()
    await loaded()

    fireEvent.click(screen.getByRole('button', { name: 'google' }))

    await waitFor(() => {
      expect(boundary.authOperations.createGoogleAuthorization).toHaveBeenCalledWith(redirectTo)
      expect(boundary.launchAuthUrl).toHaveBeenCalledWith(
        'https://accounts.google.test/authorize?state=private',
      )
    })
  })

  it('exchanges an initial web callback once and removes OAuth parameters from the current path', async () => {
    window.history.replaceState({}, '', '/?view=today&code=web-once')
    renderProvider()

    await loaded()

    expect(boundary.authOperations.exchangeOAuthCode).toHaveBeenCalledWith('web-once')
    expect(window.location.pathname).toBe('/')
    expect(window.location.search).toBe('?view=today')
  })

  it('does not let a stale session snapshot overwrite an auth-state change received while it resolves', async () => {
    const stale = { access_token: 'stale-token', user: { email: 'stale@example.com' } } as Session
    const fresh = { access_token: 'fresh-token', user: { email: 'fresh@example.com' } } as Session
    let resolveSession!: (value: { data: { session: Session } }) => void
    boundary.auth.getSession.mockImplementation(
      () => new Promise((resolve) => { resolveSession = resolve }),
    )

    renderProvider()
    await waitFor(() => expect(boundary.auth.getSession).toHaveBeenCalledTimes(1))

    await act(async () => {
      boundary.emitAuthState(fresh)
      resolveSession({ data: { session: stale } })
    })

    await waitFor(() => expect(screen.getByTestId('session').textContent).toBe('fresh@example.com'))
  })

  it('consumes cold-launch and live native callbacks, but exchanges a repeated code only once', async () => {
    boundary.resetNative(true)
    boundary.getNativeLaunchUrl.mockResolvedValue('com.azmerfaiesal.clarity://auth/callback?code=cold')
    renderProvider()
    await loaded()

    await act(async () => {
      await boundary.triggerLiveUrl('com.azmerfaiesal.clarity://auth/callback?code=live')
      await boundary.triggerLiveUrl('com.azmerfaiesal.clarity://auth/callback?code=live')
    })

    expect(boundary.authOperations.exchangeOAuthCode).toHaveBeenNthCalledWith(1, 'cold')
    expect(boundary.authOperations.exchangeOAuthCode).toHaveBeenNthCalledWith(2, 'live')
    expect(boundary.authOperations.exchangeOAuthCode).toHaveBeenCalledTimes(2)
    expect(boundary.closeNativeAuthBrowser).toHaveBeenCalledTimes(3)
  })

  it('retries the same callback code after its first exchange fails', async () => {
    boundary.resetNative(true)
    boundary.authOperations.exchangeOAuthCode
      .mockResolvedValueOnce({
        ok: false,
        issue: { kind: 'network', message: 'Check your connection and try again.' },
      })
      .mockResolvedValueOnce({ ok: true, data: SESSION })
    renderProvider()
    await loaded()

    await act(async () => {
      await boundary.triggerLiveUrl('com.azmerfaiesal.clarity://auth/callback?code=retry-code')
      await boundary.triggerLiveUrl('com.azmerfaiesal.clarity://auth/callback?code=retry-code')
    })

    expect(boundary.authOperations.exchangeOAuthCode).toHaveBeenNthCalledWith(1, 'retry-code')
    expect(boundary.authOperations.exchangeOAuthCode).toHaveBeenNthCalledWith(2, 'retry-code')
  })

  it('rejects a web callback presented as an iOS cold-launch URL', async () => {
    boundary.resetNative(true)
    boundary.getNativeLaunchUrl.mockResolvedValue('http://localhost:3000/clarity/?code=wrong-platform')
    renderProvider()
    await loaded()

    expect(boundary.authOperations.exchangeOAuthCode).not.toHaveBeenCalled()
    expect(boundary.closeNativeAuthBrowser).not.toHaveBeenCalled()
  })

  it('keeps cancellation quiet and exposes only a safe provider callback issue that can be cleared', async () => {
    boundary.resetNative(true)
    renderProvider()
    await loaded()

    await act(async () => {
      await boundary.triggerLiveUrl('com.azmerfaiesal.clarity://auth/callback?error=access_denied&code=cancelled-code')
    })
    expect(screen.getByTestId('oauth-issue').textContent).toBe('none')
    expect(screen.getByTestId('oauth-completing').textContent).toBe('false')
    expect(boundary.authOperations.exchangeOAuthCode).not.toHaveBeenCalled()

    await act(async () => {
      await boundary.triggerLiveUrl('com.azmerfaiesal.clarity://auth/callback?error=server_error')
    })
    expect(screen.getByTestId('oauth-issue').textContent).toBe('We could not sign you in. Please try again.')

    fireEvent.click(screen.getByRole('button', { name: 'clear issue' }))
    expect(screen.getByTestId('oauth-issue').textContent).toBe('none')
  })

  it('clears a previous OAuth issue before beginning another Google launch', async () => {
    boundary.resetNative(true)
    renderProvider()
    await loaded()
    await act(async () => {
      await boundary.triggerLiveUrl('com.azmerfaiesal.clarity://auth/callback?error=server_error')
    })
    expect(screen.getByTestId('oauth-issue').textContent).toBe('We could not sign you in. Please try again.')

    fireEvent.click(screen.getByRole('button', { name: 'google' }))

    await waitFor(() => expect(screen.getByTestId('oauth-issue').textContent).toBe('none'))
  })

  it('returns a safe result without turning a Google-provider failure into a callback issue', async () => {
    boundary.authOperations.createGoogleAuthorization.mockResolvedValue({
      ok: false,
      issue: { kind: 'provider', message: 'We could not sign you in. Please try again.' },
    })
    renderProvider()
    await loaded()

    fireEvent.click(screen.getByRole('button', { name: 'google' }))

    await waitFor(() => expect(screen.getByTestId('google-result').textContent).toBe('We could not sign you in. Please try again.'))
    expect(screen.getByTestId('oauth-issue').textContent).toBe('none')
    expect(boundary.launchAuthUrl).not.toHaveBeenCalled()
  })

  it('returns a safe result when the browser launcher rejects', async () => {
    boundary.launchAuthUrl.mockRejectedValue(new TypeError('private browser failure'))
    renderProvider()
    await loaded()

    fireEvent.click(screen.getByRole('button', { name: 'google' }))

    await waitFor(() => expect(screen.getByTestId('google-result').textContent).toBe('Check your connection and try again.'))
    expect(screen.getByTestId('oauth-issue').textContent).toBe('none')
  })

  it('removes the live native listener on unmount, including when registration resolves late', async () => {
    boundary.resetNative(true)
    let resolveListener!: (value: typeof boundary.listener) => void
    boundary.listenForNativeAuthUrls.mockImplementation(
      () => new Promise((resolve) => { resolveListener = resolve }),
    )

    const view = renderProvider()
    await waitFor(() => expect(boundary.listenForNativeAuthUrls).toHaveBeenCalledTimes(1))
    view.unmount()

    await act(async () => {
      resolveListener(boundary.listener)
    })

    expect(boundary.listener.remove).toHaveBeenCalledTimes(1)
  })
})
