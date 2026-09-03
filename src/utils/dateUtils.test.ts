import { describe, expect, it } from 'vitest'
import { formatHomeDate } from './dateUtils'

describe('formatHomeDate', () => {
  it('includes weekday, day, month, and four-digit year', () => {
    const date = new Date(2026, 8, 3, 12)

    expect(formatHomeDate(date, 'en-GB')).toBe('Thursday 3 September 2026')
  })
})
