/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')

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

  it('owns native safe areas on all four sides and keeps the FAB above docked search', () => {
    expect(css).toContain('padding-left: env(safe-area-inset-left)')
    expect(css).toContain('padding-right: env(safe-area-inset-right)')
    expect(css).toContain('right: calc(1.25rem + env(safe-area-inset-right))')
    expect(css).toContain('bottom: calc(4.25rem + env(safe-area-inset-bottom))')
    expect(css).toContain('.native-app .native-modal-viewport')
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
})
