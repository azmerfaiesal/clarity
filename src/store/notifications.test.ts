import { describe, expect, it } from 'vitest'
import type { Habit, Task } from '../types'
import { planNativeReminders } from './notifications'

function task(id: string, reminder: Date, patch: Partial<Task> = {}): Task {
  const stamp = new Date(2026, 8, 1, 9).toISOString()
  return {
    id,
    title: `Task ${id}`,
    description: '',
    completed: false,
    priority: 'none',
    dueDate: null,
    listId: null,
    tags: [],
    favorite: false,
    reminder: reminder.toISOString(),
    recurrence: null,
    recurrenceSeriesId: null,
    recurrenceSequence: null,
    sortOrder: 0,
    createdAt: stamp,
    completedAt: null,
    updatedAt: stamp,
    deletedAt: null,
    ...patch,
  }
}

function habit(id: string, patch: Partial<Habit> = {}): Habit {
  return {
    id,
    name: `Habit ${id}`,
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
    reminderTime: '10:00',
    createdAt: new Date(2026, 8, 1, 9).toISOString(),
    logs: {},
    logNotes: {},
    lastCompleted: null,
    archivedAt: null,
    sortOrder: 0,
    source: 'manual',
    ...patch,
  }
}

describe('planNativeReminders', () => {
  const now = new Date(2026, 8, 2, 9)

  it('includes future task reminders and excludes inactive ones', () => {
    const plans = planNativeReminders(
      [
        task('open', new Date(2026, 8, 2, 11)),
        task('done', new Date(2026, 8, 2, 12), { completed: true }),
        task('deleted', new Date(2026, 8, 2, 13), { deletedAt: now.toISOString() }),
        task('past', new Date(2026, 8, 2, 8)),
      ],
      [],
      now,
    )

    expect(plans).toHaveLength(1)
    expect(plans[0]).toMatchObject({ kind: 'task', entityId: 'open', body: 'Task open' })
  })

  it('schedules only the next active occurrence from a recurring series', () => {
    const completed = task('series-current', new Date(2026, 8, 2, 11), {
      completed: true,
      recurrence: { frequency: 'daily' },
      recurrenceSeriesId: 'series-a',
      recurrenceSequence: 0,
    })
    const next = task('rec:series-a:1', new Date(2026, 8, 3, 11), {
      recurrence: { frequency: 'daily' },
      recurrenceSeriesId: 'series-a',
      recurrenceSequence: 1,
    })

    const plans = planNativeReminders([completed, next], [], now)

    expect(plans).toHaveLength(1)
    expect(plans[0]).toMatchObject({ kind: 'task', entityId: 'rec:series-a:1' })
  })

  it('rolls habit reminders forward and skips completed dates', () => {
    const plans = planNativeReminders(
      [],
      [habit('read', { logs: { '2026-09-02': 1 } })],
      now,
    )

    expect(plans[0]).toMatchObject({ kind: 'habit', entityId: 'read' })
    expect(plans[0].at.getFullYear()).toBe(2026)
    expect(plans[0].at.getMonth()).toBe(8)
    expect(plans[0].at.getDate()).toBe(3)
    expect(plans[0].at.getHours()).toBe(10)
  })

  it('stays under the iOS pending-notification limit', () => {
    const tasks = Array.from({ length: 80 }, (_, index) =>
      task(`t${index}`, new Date(2026, 8, 3 + index, 9)),
    )
    const habits = Array.from({ length: 12 }, (_, index) => habit(`h${index}`))

    const plans = planNativeReminders(tasks, habits, now)

    expect(plans).toHaveLength(60)
    expect(new Set(plans.map(({ id }) => id)).size).toBe(60)
  })
})
