# Phased Hybrid Authentication Design

**Date:** 2026-09-04
**Status:** Approved in chat; awaiting written-spec review

## Objective

Replace Clarity's email-and-password screen with a mandatory, system-themed login experience inspired by the supplied ChatGPT reference. The first release supports a six-digit email verification code and Google OAuth. Sign in with Apple remains absent until an active Apple Developer Program membership is available.

The change must preserve each existing user's Supabase identity and user-owned Clarity data while making every interaction feel smooth, expressive, and premium.

## Approved Product Decisions

- Authentication is required. There is no guest mode and no close button that bypasses login.
- Email authentication uses a six-digit one-time code, not a password or magic-link-only interface.
- Google OAuth is enabled in the first release and returns directly to Clarity after the secure provider flow.
- Sign in with Apple is not shown until the Apple Developer Program membership and native capability are available.
- Existing email users request a code with their registered email and retain their current Supabase user and data.
- Supabase remains the authentication authority. The existing database schema, `auth.uid()` ownership model, and row-level security remain unchanged.
- The sidebar Clarity icon gains a smooth beacon animation as part of the same visual-polish work.

## Architecture

### Authentication boundary

The authentication store remains the sole interface between UI components and Supabase Auth. It will expose focused operations for:

- requesting an email OTP;
- verifying an email OTP;
- starting Google OAuth;
- consuming the native OAuth callback and establishing a Supabase session;
- signing out.

The store continues to own initial-session recovery and Supabase auth-state subscriptions. Application content remains inaccessible until the store confirms an authenticated session.

### Login UI

`AuthGate` becomes an explicit state machine rather than a combined password form:

1. **Email entry:** email field, Continue button, separator, and Google button.
2. **Code entry:** six-digit input, masked destination email, resend countdown, change-email action, and verification status.
3. **Google handoff:** immediate pressed/loading feedback followed by the secure provider browser.
4. **Callback completion:** a stable “Signing you in…” state until Supabase confirms the session.
5. **Authenticated:** the login surface exits and the main Clarity interface enters.

The gate is full-screen and follows the system light or dark theme. It has no dismiss control.

### Native and web redirects

The deployed web return address is `https://azmerfaiesal.github.io/clarity/`. The iOS return address is `com.azmerfaiesal.clarity://auth/callback`. Both are registered in Supabase's redirect allowlist, and the custom scheme is registered in the native project. Google authentication opens in the platform's secure browser rather than inside an embedded credential form.

The Supabase client uses the PKCE flow. The native callback handler validates that the URL exactly matches the configured Clarity scheme and callback path, closes the provider browser, exchanges the returned one-time code for a session, and waits for the confirmed auth-state update before revealing user data. The web app performs the same code exchange when it loads with the provider callback parameter. Repeated callback delivery must be idempotent.

Apple is represented only as a future provider boundary. No Apple button, entitlement, secret, placeholder action, or disabled control is shipped in this phase.

## Account Continuity and Security

- Email OTP sign-in targets the same email identity used by existing password accounts, preserving the Supabase user ID.
- Supabase automatic identity linking handles a Google identity that presents the same verified email as an existing user.
- A Google account using a different email is a different Clarity account; no automatic data merge is attempted.
- Only the Supabase publishable client key is bundled with the application.
- The Google client secret is stored only in Google Cloud and Supabase provider configuration. It must never appear in source, generated web assets, test fixtures, logs, or Git history.
- OAuth state and PKCE protections use the supported Supabase flow; the app accepts only its exact configured callback destination.
- Error copy does not reveal whether an email account already exists.
- The existing RLS ownership rules remain the final authorization boundary after authentication.

## Email OTP Flow

1. The user enters an email and presses Continue.
2. Clarity validates the address locally, prevents a duplicate submission, and requests an OTP from Supabase.
3. The UI transitions to code entry and reports that a code was sent without disclosing account existence.
4. Six single-character visual slots accept typing, deletion, keyboard navigation, and pasting all six digits. The implementation may use one semantic input internally if that improves accessibility and paste reliability.
5. Once six digits are present, the user can submit; automatic submission is allowed only if it cannot cause repeated requests during editing or paste.
6. Supabase verifies the code. Clarity enters the main app only after a valid session is confirmed.
7. Resend remains unavailable during the server-aligned cooldown and shows a visible countdown. The user can return to change the email address.

The Supabase email template is configured to include the six-digit token rather than presenting only a magic link.

## Google OAuth Flow

1. The user presses Continue with Google.
2. The button provides immediate physical feedback and becomes locally busy, preventing duplicate launches.
3. Clarity requests the Supabase Google authorization URL with the correct web or native return destination.
4. Web opens the provider flow normally. iOS opens the platform secure browser.
5. Cancellation restores the idle login screen without treating the user action as a system failure.
6. A successful callback is validated and exchanged for a Supabase session.
7. Clarity shows “Signing you in…” until auth state is confirmed, then performs the success transition into the app.

## Motion and Premium Interaction

Motion must communicate state and remain responsive; it must not delay network operations or block recovery actions.

- The login card enters with a soft upward translation, scale-up, fade, and ambient accent glow.
- Interactive buttons compress on press, spring back, and briefly strengthen their glow.
- Loading content replaces labels without changing button geometry or shifting layout.
- Email entry and code entry transition horizontally with coordinated fade and focus transfer.
- Code slots enter with a short stagger. Typing, deletion, paste, resend, and change-email operations remain immediately responsive.
- Invalid or expired codes receive a restrained horizontal shake, error glow, and error haptic without moving the surrounding layout.
- Successful authentication uses a brighter confirmation glow followed by a scale/fade transition into Clarity.
- Google receives pressed/loading feedback before the secure browser opens and a stable callback-completion state on return.
- Primary transitions target approximately 300–450 ms with the app's spring easing and existing motion tokens.
- Each operation locks only the controls that could duplicate that operation.
- When iOS Reduce Motion or `prefers-reduced-motion` is enabled, movement, scaling, shake, and stagger are replaced with short opacity transitions. Meaning never depends on animation alone.

## Clarity Icon Beacon

The current top-left sidebar brand mark retains its dimensions and layout. Decorative layers behind it create the beacon:

- the inner amber glow breathes continuously;
- a soft outer ring expands and fades approximately every 3.5 seconds;
- the icon scales subtly up to about `1.05` without moving adjacent content;
- opening the mobile drawer triggers one slightly stronger introductory pulse;
- light and dark themes use their existing semantic accent/glow tokens;
- the effect is CSS-driven and does not create a new interactive control;
- reduced-motion mode uses a polished static glow with no pulsing, scaling, or expanding ring.

## Error and Recovery States

- **Invalid email:** inline validation, preserved input, and focus returned to the field.
- **OTP request failure:** code screen does not open; the email remains available for retry.
- **Invalid or expired OTP:** digits remain editable, the error is announced accessibly, and retry/resend actions remain available.
- **Rate limit/cooldown:** resend stays disabled and explains when it becomes available.
- **Google cancellation:** return to the idle login screen without an alarming error.
- **OAuth/network/provider failure:** show a concise recoverable message with retry.
- **Malformed or unrelated callback:** ignore it for authentication and do not alter the current session.
- **Callback delivered twice:** complete at most one session exchange and settle into one authenticated state.
- **Sign-out failure:** preserve an accurate local state, report the failure, and never show another user's data.

Errors shown to users must be actionable and safe; provider internals, tokens, secrets, and raw callback values must not be logged or displayed.

## Provider Configuration

Google setup requires authenticated access to Google Cloud and the Supabase project:

1. Configure Google Auth Platform branding and an external audience as appropriate.
2. Request only `openid`, email, and profile scopes.
3. Create a Web application OAuth client.
4. Add the Supabase project callback URL as an authorized redirect URI.
5. Add the applicable deployed Clarity origin for development/production configuration.
6. Store the Google client ID and secret in the Supabase Google provider settings.
7. Add the deployed HTTPS return URL and exact Clarity iOS callback to Supabase's redirect allowlist.
8. Configure the OTP email template and verify the production sender behavior.

If either console requests authentication, the user signs in directly. Passwords, recovery codes, `.p8` files, or provider secrets are never requested in chat.

## Testing and Acceptance Criteria

### Automated tests

- Auth-store tests cover session restoration, OTP request, OTP verification, Google URL generation, callback success/failure/idempotency, and sign-out.
- Auth-gate tests cover required login, email validation, email-to-code navigation, six-digit entry, full-code paste, backspace behavior, submit locking, resend countdown, change email, loading states, success, and each recoverable error.
- Provider tests confirm the correct redirect destination for deployed web and native iOS environments.
- Motion tests confirm state classes/attributes and reduced-motion fallbacks without relying on exact animation timing.
- Beacon tests confirm its semantic markup is unchanged, its decorative layers do not capture input, and reduced motion disables animation.
- The complete existing test suite remains green.

### Build and manual verification

- Production web build succeeds with no provider secret embedded in output.
- Capacitor synchronization succeeds.
- Xcode build succeeds for the existing Clarity iOS target.
- Login layout is checked in light and dark mode, portrait and both landscape orientations, including notch/safe-area clearance.
- One real email OTP is delivered, pasted/entered, verified, and opens the correct existing account.
- One real Google flow succeeds on the deployed web app.
- One real Google flow succeeds on the connected iPhone, returns to Clarity, and opens the correct user data.
- Google cancellation and one simulated network failure recover cleanly.
- Sign out returns to the mandatory login gate.
- Apple is not visible anywhere in the released interface.
- The beacon is visually checked on desktop and the iOS drawer for smoothness, layout stability, theme behavior, and reduced motion.

The feature is not complete until both real email OTP and real Google authentication have passed end-to-end verification. If external provider configuration is unavailable, code can be complete but the feature must be reported as awaiting provider verification.

## Documentation Updates

After implementation is verified, update both the in-app Guide and `README.md` so they describe:

- mandatory authentication;
- six-digit email verification;
- Google sign-in and its secure return to Clarity;
- Apple being unavailable until a later native phase;
- sign-out behavior and account continuity.

## External References

- [Supabase passwordless email sign-in](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [Supabase Google sign-in](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase native mobile deep linking](https://supabase.com/docs/guides/auth/native-mobile-deep-linking)
- [Supabase identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking)
- [Supabase Sign in with Apple](https://supabase.com/docs/guides/auth/social-login/auth-apple)

## Out of Scope

- Sign in with Apple implementation or visible UI.
- Guest/local-only access.
- Password login or password recovery UI.
- Manual merging of accounts with different email addresses.
- New user-profile tables or authorization roles.
- Changes to task, habit, note, or list schemas.
