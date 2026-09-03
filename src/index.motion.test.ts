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
})
