export const NATIVE_AUTH_REDIRECT = 'com.azmerfaiesal.clarity://auth/callback'
export const WEB_AUTH_REDIRECT = 'https://azmerfaiesal.github.io/clarity/'

export function authRedirectUrl(native: boolean, currentHref: string): string {
  if (native) return NATIVE_AUTH_REDIRECT

  const current = new URL(currentHref)
  if (current.origin === 'https://azmerfaiesal.github.io') return WEB_AUTH_REDIRECT
  return `${current.origin}${current.pathname}`
}

export function isExpectedAuthCallback(url: string, native: boolean): boolean {
  const candidate = new URL(url)
  const expected = new URL(native ? NATIVE_AUTH_REDIRECT : WEB_AUTH_REDIRECT)

  return (
    candidate.protocol === expected.protocol &&
    candidate.host === expected.host &&
    candidate.pathname === expected.pathname
  )
}

export function oauthCodeFromUrl(url: string): string | null {
  const code = new URL(url).searchParams.get('code')?.trim()
  return code || null
}

export function oauthProblemFromUrl(url: string): 'cancelled' | 'provider' | null {
  const error = new URL(url).searchParams.get('error')
  if (!error) return null
  return error === 'access_denied' ? 'cancelled' : 'provider'
}
