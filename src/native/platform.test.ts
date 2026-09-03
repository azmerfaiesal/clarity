import { describe, expect, it } from 'vitest'
import {
  hapticRequest,
  nativeSelectionHaptic,
  nativeSuccessHaptic,
  nativeWarningHaptic,
} from './platform'

describe('hapticRequest', () => {
  it('maps selection feedback to a light impact', () => {
    expect(hapticRequest('selection')).toEqual({ channel: 'impact', style: 'light' })
  })

  it('maps success feedback to a success notification', () => {
    expect(hapticRequest('success')).toEqual({ channel: 'notification', type: 'success' })
  })

  it('maps warning feedback to a warning notification', () => {
    expect(hapticRequest('warning')).toEqual({ channel: 'notification', type: 'warning' })
  })

  it('keeps the named feedback aliases callable', () => {
    expect(() => nativeSelectionHaptic()).not.toThrow()
    expect(() => nativeSuccessHaptic()).not.toThrow()
    expect(() => nativeWarningHaptic()).not.toThrow()
  })
})
