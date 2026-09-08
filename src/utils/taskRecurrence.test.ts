import { describe, expect, it } from 'vitest'
import type { Task } from '../types'
import {
  formatTaskRecurrence,
  normalizeTaskRecurrence,
  taskRecurrenceAnchor,
} from './taskRecurrence'

describe('normalizeTaskRecurrence', () => {
  it('normalizes selected weekdays to unique ascending values', () => {
    expect(
      normalizeTaskRecurrence({ frequency: 'selectedDays', weekdays: [5, 1, 5, 0] }),
    ).toEqual({ frequency: 'selectedDays', weekdays: [0, 1, 5] })
  })

  it.each([
    null,
    {},
    { frequency: 'selectedDays', weekdays: [] },
    { frequency: 'selectedDays', weekdays: [7] },
    { frequency: 'monthly', preferredDay: 0 },
    { frequency: 'monthly', preferredDay: 32 },
  ])('turns invalid input into no recurrence', (value) => {
    expect(normalizeTaskRecurrence(value)).toBeNull()
  })

  it('accepts each supported recurrence frequency', () => {
    expect(normalizeTaskRecurrence({ frequency: 'daily' })).toEqual({ frequency: 'daily' })
    expect(normalizeTaskRecurrence({ frequency: 'weekly' })).toEqual({ frequency: 'weekly' })
    expect(normalizeTaskRecurrence({ frequency: 'monthly', preferredDay: 31 })).toEqual({
      frequency: 'monthly',
      preferredDay: 31,
    })
  })
})

describe('formatTaskRecurrence', () => {
  it('formats a Monday, Wednesday, Friday schedule in weekday order', () => {
    expect(
      formatTaskRecurrence(
        { frequency: 'selectedDays', weekdays: [1, 3, 5] },
        new Date(2026, 8, 8, 9),
      ),
    ).toBe('Every Monday, Wednesday and Friday')
  })

  it('formats the simple schedules', () => {
    const anchor = new Date(2026, 8, 8, 9)
    expect(formatTaskRecurrence({ frequency: 'daily' }, anchor)).toBe('Every day')
    expect(formatTaskRecurrence({ frequency: 'weekly' }, anchor)).toBe('Every Tuesday')
    expect(formatTaskRecurrence({ frequency: 'monthly', preferredDay: 31 }, anchor)).toBe(
      'Monthly on day 31',
    )
  })
})

describe('taskRecurrenceAnchor', () => {
  it('prefers the reminder over the due date', () => {
    const task = {
      reminder: new Date(2026, 8, 10, 9, 30).toISOString(),
      dueDate: '2026-09-08',
    } as Task
    expect(taskRecurrenceAnchor(task)?.getDate()).toBe(10)
  })

  it('uses a local due date when there is no valid reminder', () => {
    const task = { reminder: 'invalid', dueDate: '2026-09-08' } as Task
    const anchor = taskRecurrenceAnchor(task)
    expect(anchor && [anchor.getFullYear(), anchor.getMonth() + 1, anchor.getDate()]).toEqual([
      2026, 9, 8,
    ])
  })
})
