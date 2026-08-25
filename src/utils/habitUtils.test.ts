import { describe, expect, it } from 'vitest'
import type { Habit } from '../types'
import {
  amountOn,
  bestStreak,
  completionRate,
  completionsInWeek,
  currentStreak,
  formatAmount,
  intensityOn,
  isCompletedOn,
  isScheduled,
  periodProgress,
  repetitionLabel,
  scheduledDates,
  totalAmount,
  totalCompletions,
} from './habitUtils'

/**
 * These cover the cases that are easy to get wrong and invisible when they are:
 * a unit still in progress not counting as a miss, months that lack the
 * scheduled date, leap years, and the per-week rule where a streak stops being
 * measured in days. Everything takes an explicit `today` so no test depends on
 * when it runs.
 */
function habit(over: Partial<Habit> = {}): Habit {
  return {
    id: 'h1',
    name: 'Test',
    description: '',
    repetitionType: 'daily',
    daysOfWeek: [],
    datesOfMonth: [],
    timesPerWeek: null,
    trackBy: 'checkoff',
    dailyTarget: null,
    color: '#3ddbf0',
    icon: '',
    targetStreak: null,
    reminderTime: null,
    createdAt: '2026-01-01T08:00:00.000Z',
    logs: {},
    lastCompleted: null,
    archivedAt: null,
    sortOrder: 0,
    source: 'manual',
    ...over,
  }
}

/** Days each marked done once. */
const ticks = (dates: string[]) => Object.fromEntries(dates.map((d) => [d, 1]))

describe('isScheduled', () => {
  it('treats every day as due for a daily habit', () => {
    expect(isScheduled(habit(), '2026-03-04')).toBe(true)
  })

  it('matches only the chosen weekdays', () => {
    // 2026-03-02 is a Monday.
    const h = habit({ repetitionType: 'weekly', daysOfWeek: [1, 3] })
    expect(isScheduled(h, '2026-03-02')).toBe(true)
    expect(isScheduled(h, '2026-03-03')).toBe(false)
    expect(isScheduled(h, '2026-03-04')).toBe(true)
  })

  it('matches only the chosen dates of the month', () => {
    const h = habit({ repetitionType: 'monthly', datesOfMonth: [1, 15] })
    expect(isScheduled(h, '2026-03-01')).toBe(true)
    expect(isScheduled(h, '2026-03-16')).toBe(false)
  })

  it('leaves every day open for a per-week habit', () => {
    const h = habit({ repetitionType: 'timesPerWeek', timesPerWeek: 3 })
    expect(isScheduled(h, '2026-03-02')).toBe(true)
    expect(isScheduled(h, '2026-03-03')).toBe(true)
  })
})

describe('scheduledDates — short months and leap years', () => {
  it('skips the 31st in months that have no 31st', () => {
    const h = habit({
      repetitionType: 'monthly',
      datesOfMonth: [31],
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    expect(scheduledDates(h, '2026-06-30')).toEqual(['2026-01-31', '2026-03-31', '2026-05-31'])
  })

  it('gives a 29 Feb habit an occurrence only in leap years', () => {
    const h = habit({
      repetitionType: 'monthly',
      datesOfMonth: [29],
      createdAt: '2027-01-01T00:00:00.000Z',
    })
    expect(scheduledDates(h, '2027-12-31')).not.toContain('2027-02-29')
    expect(scheduledDates(h, '2028-12-31')).toContain('2028-02-29')
  })
})

describe('currentStreak', () => {
  it('counts consecutive completed days', () => {
    const h = habit({ logs: ticks(['2026-03-01', '2026-03-02', '2026-03-03']) })
    expect(currentStreak(h, '2026-03-03')).toBe(3)
  })

  it('does not break the streak just because today is still open', () => {
    const h = habit({ logs: ticks(['2026-03-01', '2026-03-02']) })
    expect(currentStreak(h, '2026-03-03')).toBe(2)
  })

  it('breaks once the missed day is in the past', () => {
    const h = habit({ logs: ticks(['2026-03-01', '2026-03-02']) })
    expect(currentStreak(h, '2026-03-04')).toBe(0)
  })

  it('counts scheduled occurrences, not calendar days, for weekly habits', () => {
    const h = habit({
      repetitionType: 'weekly',
      daysOfWeek: [1, 3, 5],
      createdAt: '2026-03-01T00:00:00.000Z',
      logs: ticks(['2026-03-02', '2026-03-04', '2026-03-06']),
    })
    expect(currentStreak(h, '2026-03-06')).toBe(3)
  })

  it('counts a day backfilled before the habit was created', () => {
    const h = habit({
      createdAt: '2026-03-03T09:00:00.000Z',
      logs: ticks(['2026-03-02', '2026-03-03']),
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
      logs: ticks(['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04', '2026-03-06']),
    })
    expect(currentStreak(h, '2026-03-07')).toBe(1)
    expect(bestStreak(h, '2026-03-07')).toBe(4)
  })
})

describe('completionRate', () => {
  it('excludes a day that is still open from the denominator', () => {
    const h = habit({
      createdAt: '2026-03-01T00:00:00.000Z',
      logs: ticks(['2026-03-01', '2026-03-02']),
    })
    expect(completionRate(h, '2026-03-03')).toBe(1)
  })

  it('reports a partial rate after a miss', () => {
    const h = habit({ createdAt: '2026-03-01T00:00:00.000Z', logs: ticks(['2026-03-01']) })
    expect(completionRate(h, '2026-03-03')).toBe(0.5)
  })
})

describe('counted habits', () => {
  const water = (logs: Record<string, number>) =>
    habit({ trackBy: 'count', dailyTarget: 8, createdAt: '2026-03-01T00:00:00.000Z', logs })

  it('does not call a day done until it reaches its target', () => {
    expect(isCompletedOn(water({ '2026-03-01': 7 }), '2026-03-01')).toBe(false)
    expect(isCompletedOn(water({ '2026-03-01': 8 }), '2026-03-01')).toBe(true)
  })

  it('keeps partial days out of the streak', () => {
    const h = water({ '2026-03-01': 8, '2026-03-02': 3 })
    expect(currentStreak(h, '2026-03-02')).toBe(1)
    expect(currentStreak(h, '2026-03-03')).toBe(0)
  })

  it('counts days, not logs, in the lifetime total', () => {
    const h = water({ '2026-03-01': 8, '2026-03-02': 8 })
    expect(totalCompletions(h)).toBe(2)
    expect(totalAmount(h)).toBe(16)
  })

  it('ramps intensity across progress toward the target', () => {
    const at = (n: number) => intensityOn(water({ '2026-03-01': n }), '2026-03-01')
    expect(at(0)).toBe(0)
    expect(at(1)).toBe(1)
    expect(at(4)).toBe(2)
    expect(at(6)).toBe(3)
    expect(at(8)).toBe(4)
    expect(at(20)).toBe(4)
  })

  it('ignores a stray target once a habit is back to checkoff', () => {
    // Guards a habit switched back to a tick keeping an old target and
    // silently becoming impossible to complete.
    const h = habit({ trackBy: 'checkoff', dailyTarget: 8, logs: { '2026-03-01': 1 } })
    expect(isCompletedOn(h, '2026-03-01')).toBe(true)
    expect(intensityOn(h, '2026-03-01')).toBe(4)
  })
})

describe('duration habits', () => {
  const reading = (logs: Record<string, number>) =>
    habit({ trackBy: 'duration', dailyTarget: 30, createdAt: '2026-03-01T00:00:00.000Z', logs })

  it('measures the day in minutes against the target', () => {
    expect(amountOn(reading({ '2026-03-01': 20 }), '2026-03-01')).toBe(20)
    expect(isCompletedOn(reading({ '2026-03-01': 20 }), '2026-03-01')).toBe(false)
    expect(isCompletedOn(reading({ '2026-03-01': 30 }), '2026-03-01')).toBe(true)
  })

  it('totals minutes separately from completed days', () => {
    const h = reading({ '2026-03-01': 45, '2026-03-02': 10 })
    expect(totalAmount(h)).toBe(55)
    expect(totalCompletions(h)).toBe(1)
  })

  it('formats minutes as hours once past sixty', () => {
    const h = reading({})
    expect(formatAmount(h, 45)).toBe('45m')
    expect(formatAmount(h, 60)).toBe('1h')
    expect(formatAmount(h, 90)).toBe('1h 30m')
    expect(formatAmount(habit({ trackBy: 'count' }), 5)).toBe('5')
  })
})

describe('X per week habits', () => {
  // Week of Sun 1 Mar 2026 through Sat 7 Mar.
  const gym = (logs: Record<string, number>) =>
    habit({
      repetitionType: 'timesPerWeek',
      timesPerWeek: 3,
      createdAt: '2026-03-01T00:00:00.000Z',
      logs,
    })

  it('counts completions inside the week whichever days they fall on', () => {
    const h = gym(ticks(['2026-03-02', '2026-03-05', '2026-03-07']))
    expect(completionsInWeek(h, '2026-03-04')).toBe(3)
  })

  it('measures the streak in weeks, not days', () => {
    const h = gym(
      ticks([
        '2026-03-02', '2026-03-04', '2026-03-06', // week 1: 3
        '2026-03-09', '2026-03-11', '2026-03-13', // week 2: 3
      ]),
    )
    // Standing in week 3, which is still open.
    expect(currentStreak(h, '2026-03-16')).toBe(2)
  })

  it('does not fail a week that is short but still has days left', () => {
    const h = gym(ticks(['2026-03-02', '2026-03-04', '2026-03-06', '2026-03-09']))
    // Week 2 has one of three so far, but it is only Monday.
    expect(currentStreak(h, '2026-03-09')).toBe(1)
  })

  it('breaks the streak once a short week is over', () => {
    const h = gym(ticks(['2026-03-02', '2026-03-04', '2026-03-06', '2026-03-09']))
    // Week 2 finished with one of three.
    expect(currentStreak(h, '2026-03-16')).toBe(0)
  })

  it('reports progress out of the weekly target', () => {
    const h = gym(ticks(['2026-03-02', '2026-03-04']))
    expect(periodProgress(h, '2026-03-05')).toMatchObject({ done: 2, total: 3, label: 'this week' })
  })

  it('remembers the best run of weeks', () => {
    const h = gym(
      ticks([
        '2026-03-02', '2026-03-04', '2026-03-06',
        '2026-03-09', '2026-03-11', '2026-03-13',
        // week 3 skipped entirely
        '2026-03-23',
      ]),
    )
    expect(bestStreak(h, '2026-03-24')).toBe(2)
  })

  it('rates weeks, not days', () => {
    const h = gym(ticks(['2026-03-02', '2026-03-04', '2026-03-06', '2026-03-09']))
    // Week 1 met the target, week 2 did not; week 3 is current and unmet.
    expect(completionRate(h, '2026-03-16')).toBe(0.5)
  })
})

describe('repetitionLabel', () => {
  it('describes each repetition type', () => {
    expect(repetitionLabel(habit())).toBe('Daily')
    expect(repetitionLabel(habit({ repetitionType: 'weekly', daysOfWeek: [1, 2, 3, 4, 5] }))).toBe(
      'Weekdays',
    )
    expect(repetitionLabel(habit({ repetitionType: 'weekly', daysOfWeek: [0, 6] }))).toBe('Weekends')
    expect(repetitionLabel(habit({ repetitionType: 'weekly', daysOfWeek: [1, 3, 5] }))).toBe(
      'Weekly · Mon, Wed, Fri',
    )
    expect(repetitionLabel(habit({ repetitionType: 'monthly', datesOfMonth: [1, 2, 11] }))).toBe(
      'Monthly · 1st, 2nd, 11th',
    )
    expect(
      repetitionLabel(habit({ repetitionType: 'timesPerWeek', timesPerWeek: 4 })),
    ).toBe('4× per week')
  })
})
