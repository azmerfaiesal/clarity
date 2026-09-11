/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')
const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8')

describe('motion CSS foundation', () => {
  it('defines shared motion tokens and lifecycle selectors', () => {
    expect(css).toContain('--motion-press: 160ms')
    expect(css).toContain('--motion-standard: 320ms')
    expect(css).toContain('--motion-prominent: 420ms')
    expect(css).toContain('--motion-exit: 280ms')
    expect(css).toContain('--ease-spring:')
    expect(css).toContain('--ease-exit:')
    expect(css).toContain("[data-motion-state='entering']")
    expect(css).toContain("[data-motion-state='entered']")
    expect(css).toContain("[data-motion-state='exiting']")
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
  })

  it('keeps reduced motion to short opacity changes without spatial travel', () => {
    const reducedMotion = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))

    expect(reducedMotion).toContain('scale: 1 !important')
    expect(reducedMotion).toContain('transform: translateY(0) !important')
    expect(reducedMotion).toContain('animation: motion-content-fade var(--motion-press) ease both !important')
    expect(reducedMotion).toContain('transition-duration: var(--motion-press) !important')
  })

  it('removes Routine detail-rail travel, blur, and keyed motion for reduced motion', () => {
    const reducedMotion = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
    const detailRuleStart = reducedMotion.indexOf('.routine-day-detail,')
    const detailRule = reducedMotion.slice(
      detailRuleStart,
      reducedMotion.indexOf('\n  }', detailRuleStart),
    )

    expect(detailRuleStart).toBeGreaterThan(-1)
    expect(detailRule).toContain('transform: none !important')
    expect(detailRule).toContain('filter: none !important')
    expect(detailRule).toContain('transition-property: opacity !important')
    expect(reducedMotion).toMatch(
      /\.routine-day-detail-content[\s\S]*animation:\s*none !important;/,
    )
  })

  it('provides the full app-wide interaction and content motion inventory', () => {
    for (const name of [
      '.motion-interactive',
      '.motion-primary',
      '.motion-overlay',
      '.motion-dialog',
      '.motion-popover',
      '.motion-content',
      '.motion-page',
    ]) {
      expect(css).toContain(name)
    }
  })

  it('animates the recurring-task disclosure and neutralizes it for reduced motion', () => {
    expect(css).toContain('.motion-repeat-panel')
    expect(css).toContain(".motion-repeat-panel[data-open='true']")
    const reducedMotion = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(reducedMotion).toContain('.motion-repeat-panel')
  })

  it('neutralizes independent scale, transforms, and long transitions for reduced motion', () => {
    const reducedMotion = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))

    expect(reducedMotion).toContain('scale: 1 !important')
    expect(reducedMotion).toContain('transform: translateY(0) !important')
    expect(reducedMotion).toContain('transition-duration: var(--motion-press) !important')
    expect(reducedMotion).toContain('.motion-popover')
    expect(reducedMotion).toContain('.motion-content')
    expect(reducedMotion).toContain('.motion-page')
  })

  it('owns native safe areas on all four sides and keeps creation docked with search', () => {
    expect(css).toContain('padding-left: env(safe-area-inset-left)')
    expect(css).toContain('padding-right: env(safe-area-inset-right)')
    expect(appSource).toContain('className="native-search-dock relative shrink-0"')
    expect(appSource.indexOf('className="native-search-dock relative shrink-0"')).toBeLessThan(
      appSource.indexOf('<GlobalSearch'),
    )
    expect(css).toContain('.native-app .native-modal-viewport')
  })

  it('keeps the mobile task add control at 44 by 30 and defines button-origin routine motion', () => {
    const nativeTriggerStart = css.indexOf(
      ".composer-launcher[data-variant='native'] .composer-launcher-trigger",
    )
    const nativeTriggerRule = css.slice(
      nativeTriggerStart,
      css.indexOf('\n}', nativeTriggerStart),
    )

    expect(nativeTriggerRule).toContain('width: 44px')
    expect(nativeTriggerRule).toContain('height: 30px')
    expect(css).toContain('.routine-composer-viewport')
    expect(css).toContain('.routine-composer-modal')
    expect(css).toContain('var(--routine-anchor-x)')
    expect(css).toContain('var(--routine-anchor-y)')
    const reducedMotion = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(reducedMotion).toContain('.routine-composer-modal')
    expect(reducedMotion).toContain('filter: none !important')
  })

  it('docks the native creation launcher beside search and fans its actions up and left', () => {
    expect(css).toContain('.composer-launcher-trigger')
    expect(css).toMatch(/\.composer-launcher-trigger\s*\{[\s\S]*width:\s*44px[\s\S]*height:\s*30px/)
    expect(css).toContain('.composer-launcher-layer[data-open=\'true\']')
    expect(css).toContain('.composer-launcher-action:nth-child(1)')
    expect(css).toContain('.composer-launcher-action:nth-child(2)')
    expect(css).toContain('.composer-launcher-action:nth-child(3)')
    expect(appSource).toContain('trailing={')

    const reducedMotion = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(reducedMotion).toContain('.composer-launcher-action')
    expect(reducedMotion).toContain('.composer-launcher-plus')
  })

  it('gives the web launcher the former header button footprint and a straight-up fan', () => {
    expect(css).toContain(".composer-launcher[data-variant='web']")
    expect(css).toMatch(
      /\.composer-launcher\[data-variant='web'\] \.composer-launcher-trigger\s*\{[\s\S]*padding:\s*0\.375rem 0\.75rem/,
    )
    expect(css).toContain(".composer-launcher-layer[data-layout='vertical']")
    expect(css).toContain('--composer-action-x: 0px')
    expect(appSource).toContain("variant={isNativeApp ? 'native' : 'web'}")
    expect(appSource).not.toContain('compactTaskEntry && !isNativeApp && acceptsNewTask(view)')
  })

  it('keeps native toasts inside two-sided safe bounds and protects every full-screen dialog', () => {
    const nativeToast = css.slice(
      css.indexOf('.native-app .anim-toast-in'),
      css.indexOf('\n}\n\nbody', css.indexOf('.native-app .anim-toast-in')),
    )
    const nativePresentation = css.slice(
      css.indexOf('.native-app .anim-fade-in.fixed.inset-0.z-50:not(.native-settings-overlay)'),
      css.indexOf(
        '\n}',
        css.indexOf('.native-app .anim-fade-in.fixed.inset-0.z-50:not(.native-settings-overlay)'),
      ),
    )

    expect(nativeToast).toContain('left: calc(1rem + env(safe-area-inset-left))')
    expect(nativeToast).toContain('right: calc(1rem + env(safe-area-inset-right))')
    expect(nativeToast).toContain('transform: translateY(0) scale(1)')
    expect(nativePresentation).toContain('padding-top: env(safe-area-inset-top)')
    expect(nativePresentation).toContain('padding-right: env(safe-area-inset-right)')
    expect(nativePresentation).toContain('padding-bottom: env(safe-area-inset-bottom)')
    expect(nativePresentation).toContain('padding-left: env(safe-area-inset-left)')
  })

  it('keeps the dedicated native composer gutter out of the generic overlay rule', () => {
    const genericMotionOverlayStart = css.indexOf(
      '.native-app .motion-overlay.fixed.inset-0.z-50:not(.native-settings-overlay)',
    )
    const genericMotionOverlaySelector = css.slice(
      genericMotionOverlayStart,
      css.indexOf('{', genericMotionOverlayStart),
    )
    const nativeComposerStart = css.indexOf('.native-app .native-modal-viewport')
    const nativeComposerRule = css.slice(
      nativeComposerStart,
      css.indexOf('\n}', nativeComposerStart),
    )

    expect(genericMotionOverlayStart).toBeGreaterThanOrEqual(0)
    expect(genericMotionOverlaySelector).toContain(':not(.native-modal-viewport)')
    expect(nativeComposerRule).toContain(
      'padding-right: calc(env(safe-area-inset-right) + 0.75rem)',
    )
    expect(nativeComposerRule).toContain(
      'padding-left: calc(env(safe-area-inset-left) + 0.75rem)',
    )
    expect(css).toContain(
      ".motion-overlay[data-motion-state='exiting'] {\n  pointer-events: auto;",
    )
  })

  it('defines the premium login, OTP, invalid, and success motion hooks', () => {
    expect(css).toContain('.auth-screen')
    expect(css).toContain('.auth-card')
    expect(css).toContain('.auth-step')
    expect(css).toContain('.auth-provider-button')
    expect(css).toContain('.otp-input')
    expect(css).toContain('.otp-input-control')
    expect(css).toContain('.otp-slots')
    expect(css).toContain('.otp-slot')
    expect(css).toContain(".auth-card[data-invalid='true']")
    expect(css).toContain(".auth-card[data-auth-success='true']")
    expect(css).toContain(".auth-screen[data-motion-state='exiting']")
  })

  it('keeps login motion on composited visual properties with bounded OTP staggering', () => {
    const authMotion = css.slice(css.indexOf('.auth-screen'), css.indexOf('@media (prefers-reduced-motion: reduce)'))

    expect(authMotion).toContain('transform: translateY(18px)')
    expect(authMotion).toContain('scale: 0.96')
    expect(authMotion).toContain('opacity: 0')
    expect(authMotion).toContain('animation-delay: min(calc(var(--otp-index) * 34ms), 170ms)')
    expect(authMotion).not.toMatch(/transition[^;]*(?:width|height|top|right|bottom|left|margin|padding)/)
  })

  it('protects the login on all safe-area sides including landscape notches', () => {
    const authScreenStart = css.indexOf('.auth-screen')
    const authScreenRule = css.slice(authScreenStart, css.indexOf('\n}', authScreenStart))

    expect(authScreenRule).toContain('env(safe-area-inset-top)')
    expect(authScreenRule).toContain('env(safe-area-inset-right)')
    expect(authScreenRule).toContain('env(safe-area-inset-bottom)')
    expect(authScreenRule).toContain('env(safe-area-inset-left)')
    expect(css).toMatch(/orientation:\s*landscape[\s\S]*safe-area-inset-left[\s\S]*safe-area-inset-right/)
  })

  it('removes login travel, scale, shake, and stagger while retaining a short fade', () => {
    const reducedMotion = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))

    expect(css).toMatch(/prefers-reduced-motion[\s\S]*\.auth-card/)
    expect(css).toMatch(/prefers-reduced-motion[\s\S]*\.otp-slot/)
    expect(reducedMotion).toContain('.auth-step')
    expect(reducedMotion).toContain('transform: none !important')
    expect(reducedMotion).toContain('scale: 1 !important')
    expect(reducedMotion).toContain('animation-delay: 0ms !important')
    expect(reducedMotion).toContain('transition-property: opacity !important')
    expect(reducedMotion).toContain('transition-duration: var(--motion-press) !important')
  })

  it('keeps reduced-motion login opacity authoritative for every presence phase', () => {
    const reducedMotion = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))

    expect(reducedMotion).toContain(
      ".auth-screen[data-motion-state='entering'],\n  .auth-screen[data-motion-state='entered'] {\n    opacity: 1 !important;\n    animation: none !important;",
    )
    expect(reducedMotion).toContain(
      ".auth-screen[data-motion-state='exiting'] {\n    opacity: 0 !important;\n    animation: none !important;",
    )
    expect(reducedMotion).toMatch(
      /\.auth-screen[\s\S]*transition-property:\s*opacity !important;[\s\S]*transition-duration:\s*var\(--motion-press\) !important;/,
    )
  })

  it('keeps the non-interactive brand beacon ambient, drawer-responsive, and motion-safe', () => {
    const sidebar = readFileSync(resolve(process.cwd(), 'src/components/Sidebar.tsx'), 'utf8')

    expect(css).toContain('@keyframes clarity-beacon-breathe')
    expect(css).toContain('@keyframes clarity-beacon-ring')
    expect(css).toContain('.clarity-beacon::after')
    expect(css).toContain(".clarity-beacon[data-drawer-open='true']")
    expect(css).toMatch(/prefers-reduced-motion[\s\S]*\.clarity-beacon/)
    expect(sidebar).toContain('className="clarity-beacon')
    expect(sidebar).toContain('data-drawer-open={mobileOpen || undefined}')
    expect(sidebar).toContain('>Clarity</span>')
  })
})
