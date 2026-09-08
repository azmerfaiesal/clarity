import { describe, expect, it } from 'vitest'
import type { Task } from '../types'
import {
  formatTaskRecurrence,
  nextTaskOccurrence,
  normalizeTaskRecurrence,
  recurringOccurrenceId,
  taskRecurrenceAnchor,
} from './taskRecurrence'

function recurringTask(patch: Partial<Task> = {}): Task {
  return {
    id: 'current',
    title: 'Recurring task',
    description: '',
    completed: false,
    priority: 'none',
    dueDate: null,
    listId: null,
    tags: [],
    favorite: false,
    reminder: null,
    recurrence: { frequency: 'daily' },
    recurrenceSeriesId: 'series-a',
    recurrenceSequence: 0,
    sortOrder: 0,
    createdAt: '2026-09-01T00:00:00.000Z',
    completedAt: null,
    updatedAt: '2026-09-01T00:00:00.000Z',
    deletedAt: null,
    ...patch,
  }
}

function localParts(date: Date): number[] {
  return [
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
  ]
}

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

describe('nextTaskOccurrence', () => {
  it('moves a daily reminder to the first slot after late completion', () => {
    const task = recurringTask({
      reminder: new Date(2026, 8, 5, 9, 30).toISOString(),
      dueDate: '2026-09-05',
    })
    const next = nextTaskOccurrence(task, new Date(2026, 8, 8, 10))!
    expect(localParts(new Date(next.reminder!))).toEqual([2026, 9, 9, 9, 30])
    expect(next.dueDate).toBe('2026-09-09')
  })

  it('finds the next selected weekday', () => {
    const task = recurringTask({
      reminder: new Date(2026, 8, 7, 8).toISOString(),
      recurrence: { frequency: 'selectedDays', weekdays: [1, 3, 5] },
    })
    const next = nextTaskOccurrence(task, new Date(2026, 8, 7, 12))!
    expect(localParts(new Date(next.reminder!))).toEqual([2026, 9, 9, 8, 0])
  })

  it('advances weekly at the same local wall-clock time', () => {
    const task = recurringTask({
      reminder: new Date(2026, 8, 8, 14, 45).toISOString(),
      recurrence: { frequency: 'weekly' },
    })
    const next = nextTaskOccurrence(task, new Date(2026, 8, 8, 15))!
    expect(localParts(new Date(next.reminder!))).toEqual([2026, 9, 15, 14, 45])
  })

  it('restores the preferred monthly day after a short month', () => {
    const feb = nextTaskOccurrence(
      recurringTask({
        reminder: new Date(2027, 0, 31, 9).toISOString(),
        recurrence: { frequency: 'monthly', preferredDay: 31 },
      }),
      new Date(2027, 0, 31, 12),
    )!
    expect(localParts(new Date(feb.reminder!)).slice(0, 3)).toEqual([2027, 2, 28])

    const mar = nextTaskOccurrence(
      recurringTask({
        reminder: feb.reminder,
        recurrence: { frequency: 'monthly', preferredDay: 31 },
      }),
      new Date(2027, 1, 28, 12),
    )!
    expect(localParts(new Date(mar.reminder!)).slice(0, 3)).toEqual([2027, 3, 31])
  })

  it('uses February 29 in a leap year', () => {
    const next = nextTaskOccurrence(
      recurringTask({
        reminder: new Date(2028, 0, 31, 9).toISOString(),
        recurrence: { frequency: 'monthly', preferredDay: 31 },
      }),
      new Date(2028, 0, 31, 12),
    )!
    expect(localParts(new Date(next.reminder!)).slice(0, 3)).toEqual([2028, 2, 29])
  })

  it('handles Saturday and Sunday in selected days', () => {
    const task = recurringTask({
      reminder: new Date(2026, 8, 4, 8).toISOString(),
      recurrence: { frequency: 'selectedDays', weekdays: [0, 6] },
    })
    const saturday = nextTaskOccurrence(task, new Date(2026, 8, 4, 12))!
    expect(new Date(saturday.reminder!).getDay()).toBe(6)
    const sunday = nextTaskOccurrence(
      { ...task, reminder: saturday.reminder },
      new Date(2026, 8, 5, 12),
    )!
    expect(new Date(sunday.reminder!).getDay()).toBe(0)
  })

  it('supports recurrence anchored only by a due date', () => {
    const next = nextTaskOccurrence(
      recurringTask({ reminder: null, dueDate: '2026-09-08' }),
      new Date(2026, 8, 8, 12),
    )!
    expect(next.reminder).toBeNull()
    expect(next.dueDate).toBe('2026-09-09')
  })

  it('falls back from an invalid reminder to a valid due date', () => {
    const next = nextTaskOccurrence(
      recurringTask({ reminder: 'invalid', dueDate: '2026-09-08' }),
      new Date(2026, 8, 8, 12),
    )!
    expect(next.reminder).toBeNull()
    expect(next.dueDate).toBe('2026-09-09')
  })

  it('returns null without a valid recurrence anchor', () => {
    expect(
      nextTaskOccurrence(recurringTask({ reminder: null, dueDate: null }), new Date(2026, 8, 8)),
    ).toBeNull()
  })
})

describe('recurringOccurrenceId', () => {
  it('creates the same id for the same series and sequence', () => {
    expect(recurringOccurrenceId('series-a', 4)).toBe(recurringOccurrenceId('series-a', 4))
  })

  it('separates different sequences and series', () => {
    expect(recurringOccurrenceId('series-a', 4)).not.toBe(recurringOccurrenceId('series-a', 5))
    expect(recurringOccurrenceId('series-a', 4)).not.toBe(recurringOccurrenceId('series-b', 4))
  })
})
