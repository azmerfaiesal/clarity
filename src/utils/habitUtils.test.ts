import { describe, expect, it } from 'vitest'
import type { Habit } from '../types'
import {
  bestStreak,
  completionRate,
  currentStreak,
  isScheduled,
  periodProgress,
  repetitionLabel,
  scheduledDates,
} from './habitUtils'

/**
 * These cover the cases that are easy to get wrong and invisible when they are:
 * an open day not counting as a miss, months that lack the scheduled date, and
 * leap years. Everything takes an explicit `today` so no test depends on when
 * it runs.
 */
function habit(over: Partial<Habit> = {}): Habit {
  return {
    id: 'h1',
    name: 'Test',
    description: '',
    repetitionType: 'daily',
    daysOfWeek: [],
    datesOfMonth: [],
    color: '#3ddbf0',
    icon: '',
    targetStreak: null,
    createdAt: '2026-01-01T08:00:00.000Z',
    completedDates: [],
    lastCompleted: null,
    archivedAt: null,
    ...over,
  }
}

describe('isScheduled', () => {
  it('treats every day as due for a daily habit', () => {
    expect(isScheduled(habit(), '2026-03-04')).toBe(true)
  })

  it('matches only the chosen weekdays', () => {
    // 2026-03-02 is a Monday.
    const h = habit({ repetitionType: 'weekly', daysOfWeek: [1, 3] })
    expect(isScheduled(h, '2026-03-02')).toBe(true) // Mon
    expect(isScheduled(h, '2026-03-03')).toBe(false) // Tue
    expect(isScheduled(h, '2026-03-04')).toBe(true) // Wed
  })

  it('matches only the chosen dates of the month', () => {
    const h = habit({ repetitionType: 'monthly', datesOfMonth: [1, 15] })
    expect(isScheduled(h, '2026-03-01')).toBe(true)
    expect(isScheduled(h, '2026-03-15')).toBe(true)
    expect(isScheduled(h, '2026-03-16')).toBe(false)
  })
})

describe('scheduledDates — short months and leap years', () => {
  it('skips the 31st in months that have no 31st', () => {
    const h = habit({
      repetitionType: 'monthly',
      datesOfMonth: [31],
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    const dates = scheduledDates(h, '2026-06-30')
    // Jan, Mar and May have a 31st; Feb, Apr and Jun do not.
    expect(dates).toEqual(['2026-01-31', '2026-03-31', '2026-05-31'])
  })

  it('gives a 29 Feb habit an occurrence only in leap years', () => {
    const h = habit({
      repetitionType: 'monthly',
      datesOfMonth: [29],
      createdAt: '2027-01-01T00:00:00.000Z',
    })
    // 2027 is not a leap year; 2028 is.
    expect(scheduledDates(h, '2027-12-31')).not.toContain('2027-02-29')
    expect(scheduledDates(h, '2028-12-31')).toContain('2028-02-29')
  })
})

describe('currentStreak', () => {
  it('counts consecutive completed days', () => {
    const h = habit({ completedDates: ['2026-03-01', '2026-03-02', '2026-03-03'] })
    expect(currentStreak(h, '2026-03-03')).toBe(3)
  })

  it('does not break the streak just because today is still open', () => {
    // Yesterday done, today due but not yet ticked — the day is not over.
    const h = habit({ completedDates: ['2026-03-01', '2026-03-02'] })
    expect(currentStreak(h, '2026-03-03')).toBe(2)
  })

  it('breaks once the missed day is in the past', () => {
    // 3 Mar was skipped and is now yesterday.
    const h = habit({ completedDates: ['2026-03-01', '2026-03-02'] })
    expect(currentStreak(h, '2026-03-04')).toBe(0)
  })

  it('counts scheduled occurrences, not calendar days, for weekly habits', () => {
    // Mon/Wed/Fri. Completing three in a row is a streak of 3 even though five
    // calendar days elapsed.
    const h = habit({
      repetitionType: 'weekly',
      daysOfWeek: [1, 3, 5],
      createdAt: '2026-03-01T00:00:00.000Z',
      completedDates: ['2026-03-02', '2026-03-04', '2026-03-06'],
    })
    expect(currentStreak(h, '2026-03-06')).toBe(3)
  })

  it('ignores unscheduled days entirely', () => {
    // Skipping a Tuesday is irrelevant to a Mon/Wed/Fri habit.
    const h = habit({
      repetitionType: 'weekly',
      daysOfWeek: [1, 3, 5],
      createdAt: '2026-03-01T00:00:00.000Z',
      completedDates: ['2026-03-02', '2026-03-04'],
    })
    expect(currentStreak(h, '2026-03-04')).toBe(2)
  })

  it('counts a day backfilled before the habit was created', () => {
    // Created today, but yesterday ticked retrospectively from the card.
    const h = habit({
      createdAt: '2026-03-03T09:00:00.000Z',
      completedDates: ['2026-03-02', '2026-03-03'],
    })
    expect(currentStreak(h, '2026-03-03')).toBe(2)
  })

  it('is zero for a habit never completed', () => {
    expect(currentStreak(habit(), '2026-03-04')).toBe(0)
  })
})

describe('bestStreak', () => {
  it('remembers a longer past run after the current one breaks', () => {
    const h = habit({
      createdAt: '2026-03-01T00:00:00.000Z',
      completedDates: [
        '2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04', // run of 4
        // 5 Mar missed
        '2026-03-06', // run of 1
      ],
    })
    // 6 Mar was done and 7 Mar is still open, so the live run is just 1 —
    // the four-day run is history but must still be remembered as the best.
    expect(currentStreak(h, '2026-03-07')).toBe(1)
    expect(bestStreak(h, '2026-03-07')).toBe(4)
  })

  it('is never smaller than the current streak', () => {
    const h = habit({
      createdAt: '2026-03-01T00:00:00.000Z',
      completedDates: ['2026-03-01', '2026-03-02', '2026-03-03'],
    })
    expect(bestStreak(h, '2026-03-03')).toBe(3)
  })
})

describe('completionRate', () => {
  it('excludes a day that is still open from the denominator', () => {
    // Two scheduled days have passed and both were done; today is not counted.
    const h = habit({
      createdAt: '2026-03-01T00:00:00.000Z',
      completedDates: ['2026-03-01', '2026-03-02'],
    })
    expect(completionRate(h, '2026-03-03')).toBe(1)
  })

  it('reports a partial rate after a miss', () => {
    const h = habit({
      createdAt: '2026-03-01T00:00:00.000Z',
      completedDates: ['2026-03-01'],
    })
    // 1 and 2 Mar were due, one done.
    expect(completionRate(h, '2026-03-03')).toBe(0.5)
  })
})

describe('periodProgress', () => {
  it('counts a weekly habit out of its scheduled days, not out of seven', () => {
    const h = habit({
      repetitionType: 'weekly',
      daysOfWeek: [1, 3, 5],
      createdAt: '2026-03-01T00:00:00.000Z',
      completedDates: ['2026-03-02'],
    })
    // Week of Sun 1 Mar 2026: Mon 2, Wed 4, Fri 6 are scheduled.
    expect(periodProgress(h, '2026-03-04')).toMatchObject({ done: 1, total: 3, label: 'this week' })
  })

  it('scopes a monthly habit to the calendar month', () => {
    const h = habit({
      repetitionType: 'monthly',
      datesOfMonth: [1, 15, 28],
      createdAt: '2026-03-01T00:00:00.000Z',
      completedDates: ['2026-03-01', '2026-03-15'],
    })
    expect(periodProgress(h, '2026-03-20')).toMatchObject({
      done: 2,
      total: 3,
      label: 'this month',
    })
  })
})

describe('repetitionLabel', () => {
  it('describes each repetition type', () => {
    expect(repetitionLabel(habit())).toBe('Daily')
    expect(repetitionLabel(habit({ repetitionType: 'weekly', daysOfWeek: [1, 3, 5] }))).toBe(
      'Weekly · Mon, Wed, Fri',
    )
    expect(repetitionLabel(habit({ repetitionType: 'monthly', datesOfMonth: [1, 2, 3, 11] }))).toBe(
      'Monthly · 1st, 2nd, 3rd, 11th',
    )
  })
})
