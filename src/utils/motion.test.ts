import { describe, expect, it } from 'vitest'
import { MOTION_MS, presenceTransition } from './motion'

describe('motion presence', () => {
  it('enters, exits, and can reverse an interrupted exit', () => {
    const entering = presenceTransition({ mounted: false, phase: null }, { type: 'show' })
    const entered = presenceTransition(entering, { type: 'entered' })
    const exiting = presenceTransition(entered, { type: 'hide' })

    expect(entering).toEqual({ mounted: true, phase: 'entering' })
    expect(exiting).toEqual({ mounted: true, phase: 'exiting' })
    expect(presenceTransition(exiting, { type: 'show' })).toEqual({
      mounted: true,
      phase: 'entering',
    })
    expect(MOTION_MS.prominent).toBe(420)
  })
})
