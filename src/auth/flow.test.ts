import { describe, expect, it } from 'vitest'
import {
  NATIVE_AUTH_REDIRECT,
  WEB_AUTH_REDIRECT,
  authRedirectUrl,
  isExpectedAuthCallback,
  oauthCodeFromUrl,
  oauthProblemFromUrl,
} from './flow'

describe('authentication callback contract', () => {
  it('selects exact native and deployed-web redirects', () => {
    expect(authRedirectUrl(true, 'capacitor://localhost/')).toBe(NATIVE_AUTH_REDIRECT)
    expect(authRedirectUrl(false, 'https://azmerfaiesal.github.io/clarity/?view=today')).toBe(
      WEB_AUTH_REDIRECT,
    )
    expect(authRedirectUrl(false, 'http://localhost:5173/?view=today')).toBe('http://localhost:5173/')
  })

  it('accepts only approved callbacks and extracts one code', () => {
    expect(isExpectedAuthCallback(`${NATIVE_AUTH_REDIRECT}?code=once`, true)).toBe(true)
    expect(isExpectedAuthCallback('http://localhost:5173/?code=once', false)).toBe(true)
    expect(isExpectedAuthCallback('com.azmerfaiesal.clarity://evil/callback?code=once', true)).toBe(
      false,
    )
    expect(isExpectedAuthCallback('https://attacker.example/clarity/?code=once', false)).toBe(false)
    expect(oauthCodeFromUrl(`${NATIVE_AUTH_REDIRECT}?code=once`)).toBe('once')
    expect(oauthCodeFromUrl(`${NATIVE_AUTH_REDIRECT}?error=access_denied`)).toBeNull()
    expect(oauthProblemFromUrl(`${NATIVE_AUTH_REDIRECT}?error=access_denied`)).toBe('cancelled')
    expect(oauthProblemFromUrl(`${NATIVE_AUTH_REDIRECT}?error=server_error`)).toBe('provider')
  })

  it('rejects lookalike schemes and paths for native and web callbacks', () => {
    expect(isExpectedAuthCallback('com.azmerfaiesal.clarity-fake://auth/callback?code=once', true)).toBe(
      false,
    )
    expect(isExpectedAuthCallback('http://azmerfaiesal.github.io/clarity/?code=once', false)).toBe(false)
    expect(isExpectedAuthCallback('http://localhost:5174/?code=once', false)).toBe(false)
    expect(isExpectedAuthCallback('http://localhost.evil.example:5173/?code=once', false)).toBe(false)
    expect(isExpectedAuthCallback('com.azmerfaiesal.clarity://auth/not-callback?code=once', true)).toBe(
      false,
    )
    expect(isExpectedAuthCallback('https://azmerfaiesal.github.io/clarity/not-callback?code=once', false)).toBe(
      false,
    )
  })
})
