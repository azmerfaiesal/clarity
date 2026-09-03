import { describe, expect, it } from 'vitest'
import { formatHomeDate } from './dateUtils'

describe('formatHomeDate', () => {
  it('includes weekday, day, month, and four-digit year', () => {
    const date = new Date(2026, 8, 3, 12)
    const formatted = formatHomeDate(date, 'en-GB')
    const parts = new Intl.DateTimeFormat('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).formatToParts(date)

    expect(formatted).toBe(
      date.toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    )
    expect(formatted).toContain(parts.find((part) => part.type === 'weekday')?.value)
    expect(formatted).toContain(parts.find((part) => part.type === 'day')?.value)
    expect(formatted).toContain(parts.find((part) => part.type === 'month')?.value)
    expect(formatted).toContain(parts.find((part) => part.type === 'year')?.value)
  })
})
