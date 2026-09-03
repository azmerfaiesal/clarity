import { describe, expect, it } from 'vitest'
import type { Habit } from '../types'
import { habitCompletionFeedback } from './habitFeedback'

const date = '2026-09-04'

function countedHabit(amount: number): Habit {
  return {
    id: 'h1',
    name: 'Read',
    description: '',
    repetitionType: 'daily',
    daysOfWeek: [],
    datesOfMonth: [],
    timesPerWeek: null,
    trackBy: 'count',
    dailyTarget: 3,
    color: '#3ddbf0',
    icon: '',
    targetStreak: null,
    reminderTime: null,
    createdAt: '2026-09-01T08:00:00.000Z',
    logs: { [date]: amount },
    logNotes: {},
    lastCompleted: null,
    archivedAt: null,
    sortOrder: 0,
    source: 'manual',
  }
}

describe('habitCompletionFeedback', () => {
  it('gives handleAdjust success when a counted habit reaches its target', () => {
    expect(habitCompletionFeedback(countedHabit(2), date, 3)).toBe('success')
  })

  it('gives handleAdjust selection when a counted habit falls below its target', () => {
    expect(habitCompletionFeedback(countedHabit(3), date, 2)).toBe('selection')
  })

  it('gives handleSetAmount success when a counted habit reaches its target', () => {
    expect(habitCompletionFeedback(countedHabit(2), date, 3)).toBe('success')
  })

  it('gives handleSetAmount selection when a counted habit falls below its target', () => {
    expect(habitCompletionFeedback(countedHabit(3), date, 2)).toBe('selection')
  })
})
