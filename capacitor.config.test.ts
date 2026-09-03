import { describe, expect, it } from 'vitest'
import config from './capacitor.config'

describe('iOS viewport surface', () => {
  it('uses the adaptive native background without adding a second safe-area inset', () => {
    expect(config.backgroundColor).toBeUndefined()
    expect(config.ios?.contentInset).toBe('never')
  })
})
