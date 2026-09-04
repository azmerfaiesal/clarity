# Phased Hybrid Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Clarity's password login with mandatory six-digit email verification and Google OAuth, add secure web/iOS callback handling, and animate the login and sidebar brand mark with premium reduced-motion-aware behavior.

**Architecture:** Supabase remains the identity and session authority. Focused auth helpers own redirect validation and Supabase calls, the React auth provider coordinates session state and native callbacks, and `AuthGate` owns only the visual state machine. Capacitor App and Browser provide the iOS handoff while the deployed website uses the same PKCE exchange through its HTTPS root.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest 4, React Testing Library, Tailwind CSS 4, Supabase JS 2.112.3, Capacitor 8, Capacitor App 8.1.1, Capacitor Browser 8.0.4, Xcode/iOS Simulator

**Spec:** `docs/superpowers/specs/2026-09-04-phased-hybrid-auth-design.md`

## Global Constraints

- Authentication is required; there is no production guest mode or dismiss button.
- Email authentication uses a six-digit one-time code, never a password field.
- Google is active only after real provider configuration and end-to-end verification.
- Apple has no button, entitlement, secret, future-provider action, or disabled control in this phase.
- The web return address is exactly `https://azmerfaiesal.github.io/clarity/`.
- The native return address is exactly `com.azmerfaiesal.clarity://auth/callback`.
- Supabase Auth uses PKCE and the app accepts only its exact configured callback destination.
- Existing user IDs, database tables, `auth.uid()` ownership, and RLS policies remain unchanged.
- No Google secret may enter source, generated assets, logs, test fixtures, shell history, or Git history.
- Primary login transitions remain approximately 300–450 ms and use existing Clarity motion tokens.
- Reduce Motion removes travel, pulsing, scaling, shake, and stagger while preserving short fades.
- Preserve unrelated working-tree content, especially the pre-existing untracked `graphify-out/` directory.
- Do not push `main` or deploy GitHub Pages without explicit publication approval after local and device QA.

## File Structure

### New files

- `src/auth/flow.ts` — exact callback constants, redirect selection, callback validation, and OAuth-code extraction.
- `src/auth/flow.test.ts` — pure web/native redirect and hostile/unrelated URL tests.
- `src/auth/operations.ts` — typed Supabase OTP/OAuth operations and safe error classification.
- `src/auth/operations.test.ts` — request-shape, success, and safe-error tests using a mocked Supabase client.
- `src/native/authBrowser.ts` — Capacitor secure-browser launch/close, launch URL, and URL-listener adapter.
- `src/native/authBrowser.test.ts` — native adapter tests with mocked Capacitor plugins.
- `src/store/auth.test.tsx` — provider/session/callback orchestration tests.
- `src/components/auth/OtpInput.tsx` — accessible one-time-code input with six visual slots.
- `src/components/auth/OtpInput.test.tsx` — typing, paste, filtering, deletion, disabled, and invalid-state tests.
- `src/components/AuthGate.test.tsx` — mandatory-gate and complete login state-machine tests.

### Modified files

- `package.json`, `package-lock.json` — pin Capacitor App 8.1.1 and Browser 8.0.4.
- `src/lib/supabase.ts`, `src/lib/supabase.test.ts` — enable explicit PKCE configuration and manual callback handling while retaining resilient fetch behavior.
- `src/store/auth.tsx` — replace password operations with OTP/Google operations and coordinate web/native callbacks idempotently.
- `src/components/AuthGate.tsx` — render email and code states, Google handoff, errors, loading, success exit, and haptics.
- `src/components/Sidebar.tsx` — add decorative beacon layers and drawer-open state without changing brand semantics or layout.
- `src/index.css`, `src/index.motion.test.ts` — login transitions, OTP/error/success states, beacon animation, and reduced-motion contracts.
- `ios/App/App/Info.plist` — register the exact Clarity callback scheme.
- `ios/App/CapApp-SPM/Package.swift`, `ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` — generated Capacitor plugin integration after synchronization.
- `src/components/Guide.tsx`, `README.md` — describe mandatory OTP/Google login, account continuity, sign out, and Apple's deferred status.

---

### Task 1: Callback Contract and Native Secure-Browser Adapter

**Files:**
- Create: `src/auth/flow.ts`
- Create: `src/auth/flow.test.ts`
- Create: `src/native/authBrowser.ts`
- Create: `src/native/authBrowser.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `ios/App/App/Info.plist`
- Modify after sync: `ios/App/CapApp-SPM/Package.swift`
- Modify after sync: `ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved`

**Interfaces:**
- Produces: `NATIVE_AUTH_REDIRECT = 'com.azmerfaiesal.clarity://auth/callback'`.
- Produces: `WEB_AUTH_REDIRECT = 'https://azmerfaiesal.github.io/clarity/'`.
- Produces: `authRedirectUrl(native: boolean, currentHref: string): string`.
- Produces: `isExpectedAuthCallback(url: string, native: boolean): boolean`.
- Produces: `oauthCodeFromUrl(url: string): string | null`.
- Produces: `oauthProblemFromUrl(url: string): 'cancelled' | 'provider' | null`.
- Produces: `launchAuthUrl(url: string, native?: boolean, navigate?: (url: string) => void): Promise<void>`.
- Produces: `openNativeAuthBrowser(url: string): Promise<void>`.
- Produces: `closeNativeAuthBrowser(): Promise<void>`.
- Produces: `getNativeLaunchUrl(): Promise<string | null>`.
- Produces: `listenForNativeAuthUrls(handler: (url: string) => void | Promise<void>): Promise<PluginListenerHandle | null>`.

- [ ] **Step 1: Write failing callback-contract tests**

Create tests that lock the exact addresses and reject lookalike schemes, hosts, and paths:

```ts
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
  })

  it('accepts only Clarity callbacks and extracts one code', () => {
    expect(isExpectedAuthCallback(`${NATIVE_AUTH_REDIRECT}?code=once`, true)).toBe(true)
    expect(isExpectedAuthCallback('com.azmerfaiesal.clarity://evil/callback?code=once', true)).toBe(false)
    expect(isExpectedAuthCallback('https://attacker.example/clarity/?code=once', false)).toBe(false)
    expect(oauthCodeFromUrl(`${NATIVE_AUTH_REDIRECT}?code=once`)).toBe('once')
    expect(oauthCodeFromUrl(`${NATIVE_AUTH_REDIRECT}?error=access_denied`)).toBeNull()
    expect(oauthProblemFromUrl(`${NATIVE_AUTH_REDIRECT}?error=access_denied`)).toBe('cancelled')
    expect(oauthProblemFromUrl(`${NATIVE_AUTH_REDIRECT}?error=server_error`)).toBe('provider')
  })
})
```

- [ ] **Step 2: Run the focused test and verify the missing module failure**

Run: `npm test -- src/auth/flow.test.ts`

Expected: FAIL because `src/auth/flow.ts` does not exist.

- [ ] **Step 3: Implement the pure callback contract**

Create `src/auth/flow.ts` with URL parsing that never uses substring matching:

```ts
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
```

- [ ] **Step 4: Run the callback tests**

Run: `npm test -- src/auth/flow.test.ts`

Expected: PASS.

- [ ] **Step 5: Install pinned native plugins**

Run:

```bash
npm install --save-exact @capacitor/app@8.1.1 @capacitor/browser@8.0.4
```

Expected: the two packages appear under `dependencies` with exact versions and the lockfile changes only for their dependency graph.

- [ ] **Step 6: Write failing native-adapter tests**

Mock `@capacitor/app`, `@capacitor/browser`, and `isNativeApp`. Inject a navigation spy into the web branch. Verify native/browser launch selection, browser close, launch URL extraction, event forwarding, and a `null` listener off native platforms:

```ts
expect(open).toHaveBeenCalledWith({ url: 'https://accounts.google.com/example' })
await launchAuthUrl('https://accounts.google.com/example', false, assign)
expect(assign).toHaveBeenCalledWith('https://accounts.google.com/example')
expect(close).toHaveBeenCalledTimes(1)
expect(await getNativeLaunchUrl()).toBe(NATIVE_AUTH_REDIRECT + '?code=once')
expect(handler).toHaveBeenCalledWith(NATIVE_AUTH_REDIRECT + '?code=twice')
```

- [ ] **Step 7: Run the native-adapter test and verify the missing module failure**

Run: `npm test -- src/native/authBrowser.test.ts`

Expected: FAIL because `src/native/authBrowser.ts` does not exist.

- [ ] **Step 8: Implement the Capacitor adapter**

Use a small boundary whose non-native branches never call a plugin:

```ts
import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import type { PluginListenerHandle } from '@capacitor/core'
import { isNativeApp } from './platform'

export async function launchAuthUrl(
  url: string,
  native = isNativeApp,
  navigate: (next: string) => void = (next) => window.location.assign(next),
): Promise<void> {
  if (native) return openNativeAuthBrowser(url)
  navigate(url)
}

export async function openNativeAuthBrowser(url: string): Promise<void> {
  if (isNativeApp) await Browser.open({ url })
}

export async function closeNativeAuthBrowser(): Promise<void> {
  if (isNativeApp) await Browser.close().catch(() => undefined)
}

export async function getNativeLaunchUrl(): Promise<string | null> {
  if (!isNativeApp) return null
  return (await App.getLaunchUrl()).url ?? null
}

export async function listenForNativeAuthUrls(
  handler: (url: string) => void | Promise<void>,
): Promise<PluginListenerHandle | null> {
  if (!isNativeApp) return null
  return App.addListener('appUrlOpen', ({ url }) => void handler(url))
}
```

- [ ] **Step 9: Register the URL scheme and synchronize iOS**

Add this exact value to `CFBundleURLTypes` in `ios/App/App/Info.plist`:

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLName</key>
    <string>com.azmerfaiesal.clarity.auth</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>com.azmerfaiesal.clarity</string>
    </array>
  </dict>
</array>
```

Run: `npx cap sync ios`

Expected: Capacitor App and Browser appear in the generated Swift package and sync completes successfully.

- [ ] **Step 10: Run focused tests and validate the plist**

Run:

```bash
npm test -- src/auth/flow.test.ts src/native/authBrowser.test.ts src/native/platform.test.ts
plutil -lint ios/App/App/Info.plist
```

Expected: all tests PASS and `Info.plist: OK`.

- [ ] **Step 11: Commit the callback infrastructure**

```bash
git add package.json package-lock.json src/auth/flow.ts src/auth/flow.test.ts src/native/authBrowser.ts src/native/authBrowser.test.ts ios/App/App/Info.plist ios/App/CapApp-SPM/Package.swift ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved
git commit -m "feat: add secure auth callback infrastructure"
```

---

### Task 2: Typed Supabase OTP and OAuth Operations

**Files:**
- Create: `src/auth/operations.ts`
- Create: `src/auth/operations.test.ts`
- Modify: `src/lib/supabase.ts`
- Modify: `src/lib/supabase.test.ts`

**Interfaces:**
- Produces: `AuthIssueKind = 'invalid-code' | 'rate-limited' | 'network' | 'provider'`.
- Produces: `AuthIssue = { kind: AuthIssueKind; message: string }`.
- Produces: `AuthResult<T = undefined> = { ok: true; data: T } | { ok: false; issue: AuthIssue }`.
- Produces: `AuthOperations` with `requestEmailCode`, `verifyEmailCode`, `createGoogleAuthorization`, and `exchangeOAuthCode`.
- Produces: `authOperations = createAuthOperations(supabase)`.
- Produces: `SUPABASE_AUTH_OPTIONS` with `flowType: 'pkce'` and `detectSessionInUrl: false`.

- [ ] **Step 1: Write failing operation tests**

Use a mocked `SupabaseClient` and assert the exact calls:

```ts
expect(auth.signInWithOtp).toHaveBeenCalledWith({
  email: 'person@example.com',
  options: { shouldCreateUser: true },
})
expect(auth.verifyOtp).toHaveBeenCalledWith({
  email: 'person@example.com',
  token: '123456',
  type: 'email',
})
expect(auth.signInWithOAuth).toHaveBeenCalledWith({
  provider: 'google',
  options: {
    redirectTo: NATIVE_AUTH_REDIRECT,
    skipBrowserRedirect: true,
  },
})
expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('once')
```

Also assert that status `429` becomes `rate-limited`, code `otp_expired` becomes `invalid-code`, a rejected fetch becomes `network`, and raw provider messages never become user-facing text.

- [ ] **Step 2: Run the operation tests and verify the missing module failure**

Run: `npm test -- src/auth/operations.test.ts`

Expected: FAIL because `src/auth/operations.ts` does not exist.

- [ ] **Step 3: Implement safe result and error mapping**

Start the module with these stable public types and messages:

```ts
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
  const candidate = error as { code?: string; status?: number; message?: string }
  if (candidate.status === 429) {
    return { kind: 'rate-limited', message: 'Please wait before trying again.' }
  }
  if (candidate.code === 'otp_expired') {
    return { kind: 'invalid-code', message: 'That code is invalid or has expired.' }
  }
  if (error instanceof TypeError) {
    return { kind: 'network', message: 'Check your connection and try again.' }
  }
  return { kind: 'provider', message: 'We could not sign you in. Please try again.' }
}
```

`createAuthOperations(client)` must call the four exact Supabase methods from Step 1, require a non-empty OAuth URL/session before returning success, and convert every failure through `safeAuthIssue`:

```ts
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
          options: { redirectTo, skipBrowserRedirect: true },
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
```

- [ ] **Step 4: Make PKCE and manual callback handling explicit**

Export and use one configuration object in `src/lib/supabase.ts`:

```ts
export const SUPABASE_AUTH_OPTIONS = {
  persistSession: true,
  autoRefreshToken: true,
  detectSessionInUrl: false,
  flowType: 'pkce',
} as const
```

Pass it as `auth: SUPABASE_AUTH_OPTIONS` to `createClient`. Do not change `resilientFetch` or its refusal/retry behavior.

- [ ] **Step 5: Extend the Supabase client contract test**

Add these assertions to `src/lib/supabase.test.ts`:

```ts
expect(SUPABASE_AUTH_OPTIONS.flowType).toBe('pkce')
expect(SUPABASE_AUTH_OPTIONS.detectSessionInUrl).toBe(false)
expect(SUPABASE_AUTH_OPTIONS.persistSession).toBe(true)
```

- [ ] **Step 6: Run focused authentication and fetch tests**

Run: `npm test -- src/auth/operations.test.ts src/lib/supabase.test.ts`

Expected: PASS, including every existing resilient-fetch test.

- [ ] **Step 7: Commit the Supabase operation boundary**

```bash
git add src/auth/operations.ts src/auth/operations.test.ts src/lib/supabase.ts src/lib/supabase.test.ts
git commit -m "feat: add Supabase OTP and Google auth operations"
```

---

### Task 3: Session Provider and Idempotent Callback Orchestration

**Files:**
- Modify: `src/store/auth.tsx`
- Create: `src/store/auth.test.tsx`

**Interfaces:**
- Consumes: `authOperations`, callback helpers, Capacitor browser adapter, `isNativeApp`, and existing reminder cleanup.
- Produces: `requestEmailCode(email: string): Promise<AuthResult>`.
- Produces: `verifyEmailCode(email: string, code: string): Promise<AuthResult<Session>>`.
- Produces: `signInWithGoogle(): Promise<AuthResult>`.
- Produces: `oauthCompleting: boolean` on `AuthState`.
- Produces: `oauthIssue: AuthIssue | null` and `clearOauthIssue(): void` on `AuthState`.
- Retains: `user`, `session`, `loading`, and `signOut()`.
- Removes: password `signIn` and `signUp` interfaces.

- [ ] **Step 1: Write failing provider tests**

Mock auth operations and the native adapter, then render a probe inside `AuthProvider`. Cover:

```tsx
function Probe() {
  const auth = useAuth()
  return (
    <>
      <span>{auth.loading ? 'loading' : auth.user?.email ?? 'signed-out'}</span>
      <button onClick={() => void auth.requestEmailCode(' PERSON@EXAMPLE.COM ')}>email</button>
      <button onClick={() => void auth.verifyEmailCode('person@example.com', '123456')}>code</button>
      <button onClick={() => void auth.signInWithGoogle()}>google</button>
    </>
  )
}
```

Assert normalized email forwarding, code forwarding, native browser launch, web URL assignment through the mocked launcher, initial web callback exchange, cold-launch native callback exchange, live `appUrlOpen` exchange, cancellation without an issue, provider callback failure with a safe issue, issue clearing, listener cleanup, and one exchange when the same code is delivered twice.

- [ ] **Step 2: Run the provider test and verify interface failures**

Run: `npm test -- src/store/auth.test.tsx`

Expected: FAIL because the context still exposes password methods and has no callback orchestration.

- [ ] **Step 3: Replace password methods with the approved interface**

Change `AuthState` to:

```ts
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
```

Normalize email with `trim().toLowerCase()` only at the provider boundary.

- [ ] **Step 4: Add one guarded callback consumer**

Use a `Set<string>` ref to prevent repeated code exchange and a single async function shared by web-load, native-launch, and live native events:

```ts
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
    }
  } finally {
    setOauthCompleting(false)
  }
}, [])
```

On web success, remove `code` and provider error parameters with `history.replaceState` while preserving the Clarity path. On unmount, remove the Capacitor listener even if its registration promise resolves after cleanup.

- [ ] **Step 5: Start Google with the correct destination**

`signInWithGoogle` clears any prior OAuth issue, selects `authRedirectUrl(isNativeApp, window.location.href)`, requests the provider URL, and then calls the testable launcher:

```ts
await launchAuthUrl(result.data.url)
```

Return a safe `AuthResult` for provider-generation or browser-launch failure. Never log the authorization URL because it carries transient flow state.

- [ ] **Step 6: Keep session restoration authoritative**

Bootstrap in this order: inspect/consume an expected initial callback, call `getSession`, subscribe to `onAuthStateChange`, then clear `loading`. Auth-state changes remain the sole writer of the lasting `session` state after initialization:

```ts
useEffect(() => {
  let active = true
  let listener: PluginListenerHandle | null = null

  void (async () => {
    if (isNativeApp) {
      const launchUrl = await getNativeLaunchUrl()
      if (launchUrl) await consumeCallback(launchUrl, true)
      listener = await listenForNativeAuthUrls((url) => consumeCallback(url, true))
    } else if (isExpectedAuthCallback(window.location.href, false)) {
      await consumeCallback(window.location.href, false)
    }

    const { data } = await supabase.auth.getSession()
    if (active) {
      setSession(data.session)
      setLoading(false)
    }
  })()

  const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
    if (active) setSession(next)
  })

  return () => {
    active = false
    subscription.subscription.unsubscribe()
    void listener?.remove()
  }
}, [consumeCallback])
```

If listener registration resolves after cleanup, remove it immediately instead of retaining it; the implementation test must exercise that race.

- [ ] **Step 7: Run provider, operation, and native tests**

Run:

```bash
npm test -- src/store/auth.test.tsx src/auth/flow.test.ts src/auth/operations.test.ts src/native/authBrowser.test.ts src/lib/supabase.test.ts
```

Expected: PASS without duplicate callback exchanges or React act warnings.

- [ ] **Step 8: Commit session orchestration**

```bash
git add src/store/auth.tsx src/store/auth.test.tsx
git commit -m "feat: orchestrate OTP and Google auth sessions"
```

---

### Task 4: Accessible Six-Digit Code Input

**Files:**
- Create: `src/components/auth/OtpInput.tsx`
- Create: `src/components/auth/OtpInput.test.tsx`

**Interfaces:**
- Produces: `OtpInput({ value, onChange, disabled, invalid, autoFocus })`.
- `value` is always zero to six ASCII digits.
- `onChange(next: string)` receives filtered/truncated input.

- [ ] **Step 1: Write failing input tests**

Cover typing, paste, filtering, backspace, focus, disabled state, and invalid semantics:

```tsx
const user = userEvent.setup()
const onChange = vi.fn()
render(<OtpInput value="" onChange={onChange} autoFocus />)
const input = screen.getByRole('textbox', { name: /six-digit verification code/i })
await user.type(input, '12a34 567')
expect(onChange).toHaveBeenLastCalledWith('123456')
expect(input).toHaveAttribute('inputmode', 'numeric')
expect(input).toHaveAttribute('autocomplete', 'one-time-code')
```

Rerender with `value="123456" invalid` and assert six visual slots, `aria-invalid="true"`, and no digit duplication in the accessibility tree.

- [ ] **Step 2: Run the test and verify the missing component failure**

Run: `npm test -- src/components/auth/OtpInput.test.tsx`

Expected: FAIL because `OtpInput` does not exist.

- [ ] **Step 3: Implement one semantic input with six visual slots**

Use one input so iOS AutoFill and full-code paste work reliably:

```tsx
const normalize = (raw: string) => raw.replace(/\D/g, '').slice(0, 6)

<div className="otp-input" data-invalid={invalid || undefined}>
  <input
    aria-label="Six-digit verification code"
    aria-invalid={invalid || undefined}
    autoComplete="one-time-code"
    inputMode="numeric"
    pattern="[0-9]*"
    maxLength={6}
    value={value}
    onChange={(event) => onChange(normalize(event.currentTarget.value))}
    disabled={disabled}
    autoFocus={autoFocus}
    className="otp-input-control"
  />
  <div aria-hidden="true" className="otp-slots">
    {Array.from({ length: 6 }, (_, index) => (
      <span className="otp-slot" data-filled={Boolean(value[index]) || undefined} key={index}>
        {value[index] ?? ''}
      </span>
    ))}
  </div>
</div>
```

The real input covers the slot row with transparent text/caret treatment rather than using `display: none`, so it remains focusable and tappable.

- [ ] **Step 4: Run the focused tests**

Run: `npm test -- src/components/auth/OtpInput.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the OTP input**

```bash
git add src/components/auth/OtpInput.tsx src/components/auth/OtpInput.test.tsx
git commit -m "feat: add accessible six-digit code input"
```

---

### Task 5: Mandatory Premium Login State Machine

**Files:**
- Modify: `src/components/AuthGate.tsx`
- Create: `src/components/AuthGate.test.tsx`
- Modify: `src/index.css`
- Modify: `src/index.motion.test.ts`

**Interfaces:**
- Consumes: the Task 3 `AuthState` operations and Task 4 `OtpInput`.
- Produces UI states: `email`, `code`, `google`, `verifying`, and authenticated exit.
- Produces resend constant: `EMAIL_OTP_COOLDOWN_SECONDS = 60`.
- Preserves the main application under the exiting login overlay only after a real session exists.

- [ ] **Step 1: Write failing mandatory-gate and email-flow tests**

Mock `useAuth` and verify:

- no password field, sign-up toggle, close button, or guest escape;
- valid email requests a code and transitions to code entry;
- invalid email stays on the first screen with an accessible error;
- the destination email is displayed without implying whether the account existed;
- six digits call `verifyEmailCode` once;
- full-code paste works through `OtpInput`;
- change-email returns with the original email preserved;
- resend remains disabled for 60 seconds, shows the countdown, and invokes one new request after expiry.

Use fake timers for the countdown and query controls by accessible name rather than CSS classes.

- [ ] **Step 2: Write failing Google, error, and success tests**

Verify these explicit outcomes:

```ts
expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeEnabled()
expect(screen.getByText('Signing you in…')).toBeVisible()
expect(screen.getByRole('alert')).toHaveTextContent('That code is invalid or has expired.')
expect(nativeWarningHaptic).toHaveBeenCalledTimes(1)
expect(nativeSuccessHaptic).toHaveBeenCalledTimes(1)
```

Google cancellation restores the button without an alert. Provider/network failures show their safe messages. When `user` changes from `null` to a real user, the login overlay receives an `exiting` state while children render underneath; an already-restored session skips the login entrance.

- [ ] **Step 3: Run the component test and verify the old password UI fails it**

Run: `npm test -- src/components/AuthGate.test.tsx`

Expected: FAIL because the current gate renders password sign-in/sign-up and lacks OTP/Google states.

- [ ] **Step 4: Implement the email and code state machine**

Replace `mode` and `password` with:

```ts
type LoginStep = 'email' | 'code'
type PendingAction = 'request-code' | 'verify-code' | 'resend' | 'google' | null

const [step, setStep] = useState<LoginStep>('email')
const [email, setEmail] = useState('')
const [code, setCode] = useState('')
const [pending, setPending] = useState<PendingAction>(null)
const [resendIn, setResendIn] = useState(0)
const [error, setError] = useState<string | null>(null)
```

Validate email with the browser's email validity plus a non-empty trimmed value. Set `resendIn` to 60 only after a successful request. Submit code only when it has six digits and no verification is already pending.

Use explicit handlers so each mutation owns one busy state:

```ts
async function requestCode(action: 'request-code' | 'resend') {
  if (pending || !emailInputRef.current?.checkValidity() || !email.trim()) {
    if (!emailInputRef.current?.checkValidity() || !email.trim()) {
      setError('Enter a valid email address.')
      emailInputRef.current?.focus()
    }
    return
  }
  setError(null)
  setPending(action)
  const result = await requestEmailCode(email)
  setPending(null)
  if (!result.ok) return setError(result.issue.message)
  setStep('code')
  setResendIn(EMAIL_OTP_COOLDOWN_SECONDS)
}

async function verifyCode() {
  if (pending || code.length !== 6) return
  setError(null)
  setPending('verify-code')
  const result = await verifyEmailCode(email, code)
  setPending(null)
  if (!result.ok) {
    setError(result.issue.message)
    nativeWarningHaptic()
  }
}
```

- [ ] **Step 5: Implement Google and callback-completion presentation**

Call `signInWithGoogle` once per press. Treat user cancellation as idle through the provider's `oauthIssue` state; show every non-cancellation issue in the shared `role="alert"` region and clear it when the user retries or changes login method. When `oauthCompleting` is true, keep the card stable with a spinner and “Signing you in…” copy:

```ts
async function continueWithGoogle() {
  if (pending) return
  clearOauthIssue()
  setError(null)
  setPending('google')
  nativeSelectionHaptic()
  const result = await signInWithGoogle()
  setPending(null)
  if (!result.ok) setError(result.issue.message)
}

useEffect(() => {
  if (!oauthIssue) return
  setError(oauthIssue.message)
  clearOauthIssue()
}, [clearOauthIssue, oauthIssue])
```

- [ ] **Step 6: Implement premium login presence and haptics**

Reuse `usePresenceValue` so a real session renders `children` immediately underneath an exiting login overlay. Apply `data-motion-state`, `data-auth-step`, `data-invalid`, and `data-auth-success` attributes as CSS hooks:

```tsx
const loginPresence = usePresenceValue(!loading && !user ? 'login' : null)
const previouslySignedOut = useRef(false)

useEffect(() => {
  if (!loading && !user) previouslySignedOut.current = true
  if (user && previouslySignedOut.current) {
    nativeSuccessHaptic()
    previouslySignedOut.current = false
  }
}, [loading, user])

if (loading) {
  return (
    <div className="auth-screen" role="status" aria-label="Restoring your session">
      <Loader2 className="h-6 w-6 animate-spin text-faint" />
    </div>
  )
}

const loginOverlay = loginPresence ? (
  <div className="auth-screen" data-motion-state={loginPresence.phase}>
    <section className="auth-card" data-auth-step={step} data-invalid={Boolean(error) || undefined}>
      {oauthCompleting ? (
        <div role="status" className="flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Signing you in…
        </div>
      ) : (
        <div className="auth-step" key={step}>
          {step === 'email' ? (
            <>
              <label htmlFor="auth-email">Email</label>
              <input
                ref={emailInputRef}
                id="auth-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.currentTarget.value)}
              />
              <button type="button" disabled={pending !== null} onClick={() => void requestCode('request-code')}>
                {pending === 'request-code' ? 'Sending code…' : 'Continue'}
              </button>
              <div className="auth-separator"><span>OR</span></div>
              <button type="button" disabled={pending !== null} onClick={() => void continueWithGoogle()}>
                {pending === 'google' ? 'Opening Google…' : 'Continue with Google'}
              </button>
            </>
          ) : (
            <>
              <p>Enter the six-digit code sent to {email.trim().toLowerCase()}.</p>
              <OtpInput
                value={code}
                onChange={setCode}
                disabled={pending === 'verify-code'}
                invalid={Boolean(error)}
                autoFocus
              />
              <button type="button" disabled={pending !== null || code.length !== 6} onClick={() => void verifyCode()}>
                {pending === 'verify-code' ? 'Verifying…' : 'Verify code'}
              </button>
              <button type="button" disabled={pending !== null || resendIn > 0} onClick={() => void requestCode('resend')}>
                {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
              </button>
              <button type="button" disabled={pending !== null} onClick={() => setStep('email')}>
                Change email
              </button>
            </>
          )}
          {error && <p role="alert">{error}</p>}
        </div>
      )}
    </section>
  </div>
) : null

if (user) return <>{children}{loginOverlay}</>
return loginOverlay
```

Call selection haptics for step/provider actions, warning for rejected verification, and success once when the session transitions from signed out to signed in.

Never delay, retry, or reverse an auth mutation because a haptic promise fails.

- [ ] **Step 7: Add scoped login and OTP motion CSS**

Add CSS for:

- `.auth-screen`, `.auth-card`, and `data-motion-state` entrance/exit;
- `.auth-step` horizontal/fade transition;
- `.auth-provider-button` press and glow behavior;
- `.otp-input`, `.otp-input-control`, `.otp-slots`, and `.otp-slot` geometry;
- six short slot delays capped below the 420 ms prominent duration;
- `.auth-card[data-invalid='true']` restrained shake/error glow;
- `.auth-card[data-auth-success='true']` confirmation glow and exit;
- native safe-area padding on all four sides;
- landscape width constrained by `env(safe-area-inset-left/right)`.

All movement uses `transform`, independent `scale`, or opacity. Nothing changes layout dimensions during transitions. Start with these exact motion contracts and adjust only values during visual QA:

```css
.auth-screen {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  padding: max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right))
    max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left));
  background: var(--bg);
  transition: opacity var(--motion-exit) ease;
}
.auth-card {
  width: min(100%, 28rem);
  transform: translateY(18px);
  scale: 0.96;
  opacity: 0;
  transition: transform var(--motion-prominent) var(--ease-spring),
    scale var(--motion-prominent) var(--ease-spring),
    opacity var(--motion-standard) ease, box-shadow var(--motion-standard) ease;
}
.auth-screen[data-motion-state='entered'] .auth-card {
  transform: translateY(0);
  scale: 1;
  opacity: 1;
}
.auth-screen[data-motion-state='exiting'] {
  opacity: 0;
  pointer-events: none;
}
.auth-screen[data-motion-state='exiting'] .auth-card {
  transform: translateY(-8px);
  scale: 1.04;
}
.auth-step {
  animation: auth-step-enter var(--motion-standard) var(--ease-spring) both;
}
.otp-slot {
  animation: auth-slot-enter var(--motion-standard) var(--ease-spring) both;
  animation-delay: min(calc(var(--otp-index) * 34ms), 170ms);
}
.auth-card[data-invalid='true'] {
  animation: auth-invalid 360ms var(--ease-spring);
  box-shadow: 0 0 32px -8px var(--danger);
}
```

- [ ] **Step 8: Extend reduced-motion contract tests**

Add static assertions to `src/index.motion.test.ts`:

```ts
expect(css).toContain('.auth-card')
expect(css).toContain('.otp-slot')
expect(css).toContain(".auth-card[data-invalid='true']")
expect(css).toMatch(/prefers-reduced-motion[\s\S]*\.auth-card/)
expect(css).toMatch(/prefers-reduced-motion[\s\S]*\.otp-slot/)
```

The reduced-motion block must set transform to none/zero travel, scale to `1`, disable shake/stagger, and retain a short opacity transition.

- [ ] **Step 9: Run login and motion tests**

Run:

```bash
npm test -- src/components/AuthGate.test.tsx src/components/auth/OtpInput.test.tsx src/index.motion.test.ts src/utils/motion.test.ts src/components/MotionPresence.test.tsx
```

Expected: PASS without timer leaks, duplicate submits, or act warnings.

- [ ] **Step 10: Commit the premium login UI**

```bash
git add src/components/AuthGate.tsx src/components/AuthGate.test.tsx src/index.css src/index.motion.test.ts
git commit -m "feat: replace password login with premium OTP flow"
```

---

### Task 6: Sidebar Clarity Beacon

**Files:**
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/index.css`
- Modify: `src/index.motion.test.ts`

**Interfaces:**
- Consumes: existing semantic accent/glow tokens and `mobileOpen`.
- Produces: `.clarity-beacon` with decorative pseudo-elements and `data-drawer-open`.
- Does not produce a new button or navigation action.

- [ ] **Step 1: Write failing beacon contract tests**

Extend `src/index.motion.test.ts` to require:

```ts
expect(css).toContain('@keyframes clarity-beacon-breathe')
expect(css).toContain('@keyframes clarity-beacon-ring')
expect(css).toContain('.clarity-beacon::after')
expect(css).toContain(".clarity-beacon[data-drawer-open='true']")
expect(css).toMatch(/prefers-reduced-motion[\s\S]*\.clarity-beacon/)
```

Read `Sidebar.tsx` in the same test and assert it contains `className="clarity-beacon` and `data-drawer-open={mobileOpen || undefined}` while the visible `Clarity` label remains present.

- [ ] **Step 2: Run the motion contract test and verify missing beacon rules**

Run: `npm test -- src/index.motion.test.ts`

Expected: FAIL because the beacon selectors and keyframes do not exist.

- [ ] **Step 3: Add non-interactive beacon markup**

Change only the brand-icon wrapper:

```tsx
<div
  className="clarity-beacon glow flex h-7 w-7 items-center justify-center rounded-md bg-accent"
  data-drawer-open={mobileOpen || undefined}
  aria-hidden="true"
>
  <CheckCircle2 className="relative z-10 h-4 w-4 text-accent-ink" strokeWidth={2.5} />
</div>
```

Keep the `Clarity` text unchanged and do not attach click handlers or pointer semantics.

- [ ] **Step 4: Implement the beacon animation**

Use `::before` for the breathing inner bloom and `::after` for a ring that expands/fades on an approximately 3.5-second cycle. Keep the wrapper's layout box at `1.75rem`, set pseudo-elements to `pointer-events: none`, and scale only an internal/pseudo layer so adjacent text never shifts. `data-drawer-open='true'` applies one stronger ring animation without replacing the ambient cycle:

```css
.clarity-beacon {
  position: relative;
  isolation: isolate;
}
.clarity-beacon::before,
.clarity-beacon::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: inherit;
  pointer-events: none;
}
.clarity-beacon::before {
  background: color-mix(in srgb, var(--accent) 56%, transparent);
  filter: blur(7px);
  animation: clarity-beacon-breathe 3.5s ease-in-out infinite;
}
.clarity-beacon::after {
  border: 1px solid color-mix(in srgb, var(--accent) 72%, transparent);
  animation: clarity-beacon-ring 3.5s var(--ease-spring) infinite;
}
.clarity-beacon > svg {
  animation: clarity-beacon-icon 3.5s ease-in-out infinite;
}
.clarity-beacon[data-drawer-open='true']::after {
  animation: clarity-beacon-open 900ms var(--ease-spring) both,
    clarity-beacon-ring 3.5s 900ms var(--ease-spring) infinite;
}
@keyframes clarity-beacon-breathe {
  0%, 100% { opacity: 0.38; scale: 0.9; }
  50% { opacity: 0.88; scale: 1.3; }
}
@keyframes clarity-beacon-ring {
  0%, 58% { opacity: 0; scale: 0.94; }
  68% { opacity: 0.72; }
  100% { opacity: 0; scale: 1.78; }
}
@keyframes clarity-beacon-icon {
  0%, 100% { scale: 1; }
  50% { scale: 1.05; }
}
@keyframes clarity-beacon-open {
  from { opacity: 0.9; scale: 0.9; }
  to { opacity: 0; scale: 2; }
}
```

In reduced motion, set every beacon animation to `none`, every scale to `1`, hide the expanding ring, and retain one static semantic glow:

```css
@media (prefers-reduced-motion: reduce) {
  .clarity-beacon,
  .clarity-beacon::before,
  .clarity-beacon::after,
  .clarity-beacon > svg {
    animation: none !important;
    scale: 1 !important;
  }
  .clarity-beacon::before { opacity: 0.5; }
  .clarity-beacon::after { display: none; }
}
```

- [ ] **Step 5: Run motion and full component tests**

Run: `npm test -- src/index.motion.test.ts src/utils/motion.test.ts src/components/AuthGate.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit the beacon**

```bash
git add src/components/Sidebar.tsx src/index.css src/index.motion.test.ts
git commit -m "feat: animate the Clarity brand beacon"
```

---

### Task 7: Product Documentation and Complete Local Verification

**Files:**
- Modify: `src/components/Guide.tsx`
- Modify: `README.md`

**Interfaces:**
- Documents the exact released behavior established by Tasks 1–6.
- Does not document Apple as available.

- [ ] **Step 1: Update the in-app Guide**

In “What it is,” add concise product copy with these exact facts:

```text
Clarity requires an account. Enter your email to receive a six-digit sign-in code, or continue with Google. Returning users keep the same tasks, habits, and notes when they use the same verified email. Sign in with Apple will appear only after native Apple account support is available.
```

Mention that sign out returns to the mandatory login screen and that offline edits remain account-namespaced.

- [ ] **Step 2: Replace README password documentation**

Replace “Sign in with email + password” in `README.md` with email OTP and Google behavior. Add an “Auth provider configuration” subsection containing only public values:

```text
Web return: https://azmerfaiesal.github.io/clarity/
iOS return: com.azmerfaiesal.clarity://auth/callback
Supabase callback registered in Google: https://pakfyyvdfwxglcjkatqz.supabase.co/auth/v1/callback
```

State explicitly that the Google client secret lives only in Supabase provider settings and Apple is not shipped in this phase.

- [ ] **Step 3: Run format, lint, tests, and production build**

Run:

```bash
git diff --check
npm run lint
npm test
npm run build
```

Expected: diff check, lint, all tests, TypeScript, and Vite production build PASS. Do not add a formatter dependency solely for this task.

- [ ] **Step 4: Scan artifacts and history for secrets**

Run:

```bash
git diff --check
git grep -n -E 'GOCSPX-[A-Za-z0-9_-]+|-----BEGIN PRIVATE KEY-----|"client_secret"[[:space:]]*:' -- ':!docs/superpowers/plans/2026-09-04-phased-hybrid-auth-implementation.md'
rg -n 'GOCSPX-[A-Za-z0-9_-]+|-----BEGIN PRIVATE KEY-----|"client_secret"\s*:' dist
```

Expected: no Google secret, private key, or refresh token. Documentation may contain the literal phrase `client_secret` only if it has no value; remove even that spelling if the scan cannot distinguish prose safely.

- [ ] **Step 5: Synchronize and build iOS**

Run:

```bash
npm run ios:sync
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

Expected: Capacitor sync and Xcode simulator build succeed with App and Browser plugins present.

- [ ] **Step 6: Commit documentation and any deterministic sync output**

```bash
git add src/components/Guide.tsx README.md ios/App/CapApp-SPM/Package.swift ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved
git commit -m "docs: explain Clarity OTP and Google login"
```

Do not stage `dist/`, `.env`, console exports, screenshots, or `graphify-out/`.

---

### Task 8: Configure Supabase Email OTP and Google OAuth

**Files:**
- No repository files; this task changes authenticated Google Cloud and Supabase project configuration.

**Interfaces:**
- Produces a Google OAuth web client stored in Google Cloud.
- Produces enabled Google provider settings in Supabase project `pakfyyvdfwxglcjkatqz`.
- Produces allowed web/native redirects and a six-digit OTP email template.

- [ ] **Step 1: Open Google Cloud without exposing credentials**

Use the authenticated browser to open Google Auth Platform. If signed out, pause for the user to sign in directly. Select an existing dedicated Clarity project or create one named `Clarity`; do not enable unrelated Google APIs.

- [ ] **Step 2: Configure consent branding and audience**

Set the application name to `Clarity`, use the signed-in account's chosen support/contact email, choose an External audience, and request only:

```text
openid
https://www.googleapis.com/auth/userinfo.email
https://www.googleapis.com/auth/userinfo.profile
```

Keep the app in testing mode until the real flow passes. Add only the user's chosen test Google account.

- [ ] **Step 3: Create the OAuth web client**

Create a Web application client named `Clarity Supabase Auth`. Add:

```text
Authorized JavaScript origin: https://azmerfaiesal.github.io
Authorized JavaScript origin: http://localhost:5173
Authorized redirect URI: https://pakfyyvdfwxglcjkatqz.supabase.co/auth/v1/callback
```

Keep the client ID/secret visible only long enough to transfer them into the authenticated Supabase form. Do not download a credential JSON file into the repository.

- [ ] **Step 4: Enable Google in Supabase**

Open Authentication → Providers → Google for project `pakfyyvdfwxglcjkatqz`, enable it, and paste the newly created client ID and secret into the dashboard fields. Save and verify the provider remains enabled after reload.

- [ ] **Step 5: Configure exact Supabase URLs**

In Authentication → URL Configuration, use the deployed Clarity address as the Site URL and allow these redirects:

```text
https://azmerfaiesal.github.io/clarity/
http://localhost:5173/
com.azmerfaiesal.clarity://auth/callback
```

Do not add wildcard custom schemes or unrelated origins.

- [ ] **Step 6: Configure the six-digit email template**

Set the sign-in template subject to `Your Clarity verification code` and make the message use the token variable:

```html
<h2>Your Clarity verification code</h2>
<p>Enter this code in Clarity:</p>
<p style="font-size:32px;font-weight:700;letter-spacing:8px">{{ .Token }}</p>
<p>If you did not request this code, you can ignore this email.</p>
```

Keep the configured expiry within Supabase's supported secure range and retain the default request cooldown unless a live test proves it unusable.

- [ ] **Step 7: Re-open both provider pages for read-back verification**

Confirm Google shows enabled, the callback list contains all three exact destinations, and the email template contains `{{ .Token }}`. Do not copy secret-bearing fields into tool output or the final report.

---

### Task 9: End-to-End Web and iPhone Acceptance

**Files:**
- No source files unless a verified defect requires returning to its owning task and repeating that task's test/commit cycle.

**Interfaces:**
- Verifies the externally configured providers against the code produced by Tasks 1–8.
- Produces an evidence-backed completion report; it does not expose email codes, tokens, or secrets.

- [ ] **Step 1: Exercise email OTP on local web**

Run `npm run dev -- --host 127.0.0.1`, open `http://localhost:5173/`, and verify:

- mandatory login with no dismiss control;
- system light/dark appearance;
- real six-digit email delivery;
- typing and full-code paste;
- invalid-code animation/message and resend cooldown;
- successful session and correct existing user data;
- sign out returns to login.

- [ ] **Step 2: Exercise local Google OAuth**

Press Continue with Google, use the configured test account, and confirm Supabase returns to Clarity and opens the correct existing account when the verified email matches. Cancel a second attempt and confirm the gate recovers without an alarming error.

- [ ] **Step 3: Install the synchronized build on the connected iPhone**

Resolve the connected device destination with:

```bash
xcrun xctrace list devices
```

Build/install using the exact device identifier returned by that command and the existing signing configuration. Never invent or persist a device identifier in the plan.

- [ ] **Step 4: Verify iPhone email and Google flows**

On the physical phone, verify one real OTP login and one real Google login. Google must open the secure browser, return via `com.azmerfaiesal.clarity://auth/callback`, close the browser, show “Signing you in…”, and reveal the correct account data exactly once.

- [ ] **Step 5: Verify premium visuals and accessibility states**

Check portrait and both landscape orientations in light and dark mode. Confirm notch/safe-area clearance, stable button geometry, email-to-code motion, error shake/glow/haptic, success transition, Google return transition, and the sidebar beacon. Enable Reduce Motion and confirm login uses short fades and the beacon becomes static.

- [ ] **Step 6: Run the final non-regression suite**

Run:

```bash
npm run lint
npm test
npm run build
git diff --check
git status --short
```

Expected: lint, all tests, build, and diff checks PASS; only intentionally untracked `graphify-out/` remains outside commits.

- [ ] **Step 7: Request publication approval before deployed-web verification**

Report the complete list of local commits ahead of `origin/main` and ask for explicit approval before `git push origin main`, because the branch already contained 21 unpublished commits before this feature. After approval, push once, wait for GitHub Pages deployment, reload `https://azmerfaiesal.github.io/clarity/` fresh, and repeat one real OTP and one Google login there.

- [ ] **Step 8: Report completion truthfully**

Claim the feature complete only if real OTP, real Google web, real Google iPhone callback, sign out, full automated tests, production build, and iOS build all passed. If publication is not approved, report deployed-web verification as pending even when local and device tests pass.
