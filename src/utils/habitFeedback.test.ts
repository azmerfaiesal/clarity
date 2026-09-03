import { describe, expect, it } from 'vitest'
import type { Habit } from '../types'
import { commitHabitAmount } from './habitFeedback'

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

describe('commitHabitAmount', () => {
  it('runs handleAdjust success feedback before mutating the threshold amount', () => {
    const events: string[] = []
    const result = commitHabitAmount({
      habit: countedHabit(2),
      date,
      operation: 'adjust',
      value: 1,
      feedback: (kind) => events.push(`feedback:${kind}`),
      mutate: (amount) => events.push(`mutate:${amount}`),
    })

    expect(result).toEqual({ amount: 3, feedback: 'success' })
    expect(events).toEqual(['feedback:success', 'mutate:3'])
  })

  it('clamps handleAdjust uncompletion before selection feedback and mutation', () => {
    const events: string[] = []
    const result = commitHabitAmount({
      habit: countedHabit(3),
      date,
      operation: 'adjust',
      value: -9,
      feedback: (kind) => events.push(`feedback:${kind}`),
      mutate: (amount) => events.push(`mutate:${amount}`),
    })

    expect(result).toEqual({ amount: 0, feedback: 'selection' })
    expect(events).toEqual(['feedback:selection', 'mutate:0'])
  })

  it('rounds handleSetAmount completion before success feedback and mutation', () => {
    const events: string[] = []
    const result = commitHabitAmount({
      habit: countedHabit(2),
      date,
      operation: 'set',
      value: 2.6,
      feedback: (kind) => events.push(`feedback:${kind}`),
      mutate: (amount) => events.push(`mutate:${amount}`),
    })

    expect(result).toEqual({ amount: 3, feedback: 'success' })
    expect(events).toEqual(['feedback:success', 'mutate:3'])
  })

  it('rounds handleSetAmount uncompletion before selection feedback and mutation', () => {
    const events: string[] = []
    const result = commitHabitAmount({
      habit: countedHabit(3),
      date,
      operation: 'set',
      value: 2.4,
      feedback: (kind) => events.push(`feedback:${kind}`),
      mutate: (amount) => events.push(`mutate:${amount}`),
    })

    expect(result).toEqual({ amount: 2, feedback: 'selection' })
    expect(events).toEqual(['feedback:selection', 'mutate:2'])
  })
})
