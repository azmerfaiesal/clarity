import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AuthGate from './AuthGate'

const haptics = vi.hoisted(() => ({
  selection: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
}))

vi.mock('../native/platform', () => ({
  nativeSelectionHaptic: haptics.selection,
  nativeSuccessHaptic: haptics.success,
  nativeWarningHaptic: haptics.warning,
}))

const requestEmailCode = vi.fn()
const verifyEmailCode = vi.fn()
const signInWithGoogle = vi.fn()
const clearOauthIssue = vi.fn()

let authState: {
  user: { id: string } | null
  session: null
  loading: boolean
  oauthCompleting: boolean
  oauthIssue: { kind: 'provider' | 'network'; message: string } | null
  requestEmailCode: typeof requestEmailCode
  verifyEmailCode: typeof verifyEmailCode
  signInWithGoogle: typeof signInWithGoogle
  clearOauthIssue: typeof clearOauthIssue
  signOut: ReturnType<typeof vi.fn>
}

vi.mock('../store/auth', () => ({ useAuth: () => authState }))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((next) => {
    resolve = next
  })
  return { promise, resolve }
}

function renderGate(children: ReactNode = <main>Private workspace</main>) {
  return render(<AuthGate>{children}</AuthGate>)
}

async function requestCode(user: ReturnType<typeof userEvent.setup>, email = 'Person@Example.com') {
  await user.type(screen.getByRole('textbox', { name: 'Email' }), email)
  await user.click(screen.getByRole('button', { name: 'Continue' }))
}

beforeEach(() => {
  requestEmailCode.mockReset().mockResolvedValue({ ok: true, data: undefined })
  verifyEmailCode.mockReset().mockResolvedValue({ ok: true, data: {} })
  signInWithGoogle.mockReset().mockResolvedValue({ ok: true, data: undefined })
  clearOauthIssue.mockReset().mockImplementation(() => {
    authState.oauthIssue = null
  })
  haptics.selection.mockReset()
  haptics.success.mockReset()
  haptics.warning.mockReset()
  authState = {
    user: null,
    session: null,
    loading: false,
    oauthCompleting: false,
    oauthIssue: null,
    requestEmailCode,
    verifyEmailCode,
    signInWithGoogle,
    clearOauthIssue,
    signOut: vi.fn(),
  }
})

afterEach(() => {
  vi.useRealTimers()
})

describe('AuthGate mandatory login', () => {
  it('offers only mandatory email-code and Google entry methods', () => {
    renderGate()

    expect(screen.getByRole('textbox', { name: 'Email' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeTruthy()
    expect(screen.queryByLabelText(/password/i)).toBeNull()
    expect(screen.queryByText(/create account|sign up|no account/i)).toBeNull()
    expect(screen.queryByRole('button', { name: /close|skip|guest/i })).toBeNull()
    expect(screen.queryByText('Private workspace')).toBeNull()
  })

  it('rejects an invalid email with an accessible error and retains the email step', async () => {
    const user = userEvent.setup()
    renderGate()

    await requestCode(user, 'not-an-email')

    expect(screen.getByRole('alert').textContent).toBe('Enter a valid email address.')
    expect(screen.getByRole('textbox', { name: 'Email' })).toBe(document.activeElement)
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy()
    expect(requestEmailCode).not.toHaveBeenCalled()
  })

  it('requests a code, gives selection feedback, and uses neutral destination copy', async () => {
    const user = userEvent.setup()
    renderGate()

    await requestCode(user)

    expect(requestEmailCode).toHaveBeenCalledTimes(1)
    expect(requestEmailCode).toHaveBeenCalledWith('Person@Example.com')
    expect(haptics.selection).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Enter the six-digit code sent to person@example.com.')).toBeTruthy()
    expect(screen.queryByText(/account (exists|created)|new account/i)).toBeNull()
  })

  it('does not delay, retry, or reverse an auth request when feedback fails', async () => {
    haptics.selection.mockImplementationOnce(() => {
      throw new Error('Haptics unavailable')
    })
    const user = userEvent.setup()
    renderGate()

    await requestCode(user, 'person@example.com')

    expect(requestEmailCode).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Enter the six-digit code sent to person@example.com.')).toBeTruthy()
  })

  it('submits six digits exactly once and warns when verification is rejected', async () => {
    const verification = deferred<{
      ok: false
      issue: { kind: 'provider'; message: string }
    }>()
    verifyEmailCode.mockReturnValue(verification.promise)
    const user = userEvent.setup()
    renderGate()
    await requestCode(user, 'person@example.com')

    await user.type(screen.getByRole('textbox', { name: 'Six-digit verification code' }), '123456')
    await user.dblClick(screen.getByRole('button', { name: 'Verify code' }))

    expect(verifyEmailCode).toHaveBeenCalledTimes(1)
    expect(verifyEmailCode).toHaveBeenCalledWith('person@example.com', '123456')

    verification.resolve({
      ok: false,
      issue: { kind: 'provider', message: 'That code is invalid or has expired.' },
    })
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('That code is invalid or has expired.')
    })
    expect(haptics.warning).toHaveBeenCalledTimes(1)
  })

  it('accepts a full-code paste through the real OTP input', async () => {
    const user = userEvent.setup()
    renderGate()
    await requestCode(user, 'person@example.com')

    const input = screen.getByRole('textbox', { name: 'Six-digit verification code' })
    await user.click(input)
    await user.paste('12x34 567')
    await user.click(screen.getByRole('button', { name: 'Verify code' }))

    expect((input as HTMLInputElement).value).toBe('123456')
    expect(verifyEmailCode).toHaveBeenCalledTimes(1)
    expect(verifyEmailCode).toHaveBeenCalledWith('person@example.com', '123456')
  })

  it('returns to the email step without erasing the original address', async () => {
    const user = userEvent.setup()
    renderGate()
    await requestCode(user)

    await user.click(screen.getByRole('button', { name: 'Change email' }))

    expect((screen.getByRole('textbox', { name: 'Email' }) as HTMLInputElement).value).toBe(
      'Person@Example.com',
    )
    expect(haptics.selection).toHaveBeenCalledTimes(2)
  })

  it('enforces a sixty-second resend cooldown before making one new request', async () => {
    vi.useFakeTimers()
    renderGate()
    fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), {
      target: { value: 'person@example.com' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    })

    const initialResend = screen.getByRole('button', {
      name: 'Resend code in 60s',
    }) as HTMLButtonElement
    expect(initialResend.disabled).toBe(true)

    await act(async () => {
      vi.advanceTimersByTime(59_000)
    })
    expect(
      (screen.getByRole('button', { name: 'Resend code in 1s' }) as HTMLButtonElement).disabled,
    ).toBe(true)

    await act(async () => {
      vi.advanceTimersByTime(1_000)
    })
    const resend = screen.getByRole('button', { name: 'Resend code' }) as HTMLButtonElement
    expect(resend.disabled).toBe(false)

    await act(async () => {
      fireEvent.click(resend)
    })

    expect(requestEmailCode).toHaveBeenCalledTimes(2)
    expect(requestEmailCode).toHaveBeenLastCalledWith('person@example.com')
    expect(
      (screen.getByRole('button', { name: 'Resend code in 60s' }) as HTMLButtonElement).disabled,
    ).toBe(true)
  })
})

describe('AuthGate Google and session outcomes', () => {
  it('keeps Google available, then restores it quietly after provider cancellation', async () => {
    const launch = deferred<{ ok: true; data: undefined }>()
    signInWithGoogle.mockReturnValue(launch.promise)
    const user = userEvent.setup()
    renderGate()

    const google = screen.getByRole('button', { name: 'Continue with Google' }) as HTMLButtonElement
    expect(google.disabled).toBe(false)
    await user.click(google)

    expect(screen.getByRole('button', { name: 'Opening Google…' })).toBeTruthy()
    expect(haptics.selection).toHaveBeenCalledTimes(1)

    launch.resolve({ ok: true, data: undefined })
    await waitFor(() => {
      expect(
        (screen.getByRole('button', { name: 'Continue with Google' }) as HTMLButtonElement).disabled,
      ).toBe(false)
    })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it.each([
    ['provider', 'We could not sign you in. Please try again.'],
    ['network', 'Check your connection and try again.'],
  ] as const)('shows a safe %s error returned by Google launch', async (kind, message) => {
    signInWithGoogle.mockResolvedValue({ ok: false, issue: { kind, message } })
    const user = userEvent.setup()
    renderGate()

    await user.click(screen.getByRole('button', { name: 'Continue with Google' }))

    expect(screen.getByRole('alert').textContent).toBe(message)
  })

  it('presents callback completion without replacing the stable card', () => {
    authState.oauthCompleting = true
    renderGate()

    expect(screen.getByRole('status').textContent).toContain('Signing you in…')
    expect(document.querySelector('.auth-card')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Continue with Google' })).toBeNull()
  })

  it('surfaces a callback issue once and clears it when switching to email', async () => {
    authState.oauthIssue = {
      kind: 'provider',
      message: 'We could not sign you in. Please try again.',
    }
    const user = userEvent.setup()
    renderGate()

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe(
        'We could not sign you in. Please try again.',
      )
    })
    expect(clearOauthIssue).toHaveBeenCalledTimes(1)

    await requestCode(user, 'person@example.com')

    expect(screen.queryByRole('alert')).toBeNull()
    expect(clearOauthIssue).toHaveBeenCalledTimes(2)
  })

  it('renders children under an exiting success overlay and fires success feedback once', () => {
    const view = renderGate()
    expect(screen.queryByText('Private workspace')).toBeNull()

    authState.user = { id: 'user-1' }
    view.rerender(
      <AuthGate>
        <main>Private workspace</main>
      </AuthGate>,
    )

    expect(screen.getByText('Private workspace')).toBeTruthy()
    expect(document.querySelector(".auth-screen[data-motion-state='exiting']")).toBeTruthy()
    expect(document.querySelector(".auth-card[data-auth-success='true']")).toBeTruthy()
    expect(haptics.success).toHaveBeenCalledTimes(1)

    view.rerender(
      <AuthGate>
        <main>Private workspace</main>
      </AuthGate>,
    )
    expect(haptics.success).toHaveBeenCalledTimes(1)
  })

  it('skips the login entrance for an already-restored session', () => {
    authState.user = { id: 'restored-user' }
    renderGate()

    expect(screen.getByText('Private workspace')).toBeTruthy()
    expect(document.querySelector('.auth-screen')).toBeNull()
    expect(haptics.success).not.toHaveBeenCalled()
  })

  it('announces session restoration without exposing login actions', () => {
    authState.loading = true
    renderGate()

    const status = screen.getByRole('status')
    expect(status.getAttribute('aria-label')).toBe('Restoring your session')
    expect(status.getAttribute('data-motion-state')).toBe('entered')
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull()
  })
})
