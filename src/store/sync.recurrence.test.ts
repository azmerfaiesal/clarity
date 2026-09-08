import { describe, expect, it } from 'vitest'
import type { Task } from '../types'
import { rowToTask, taskToRow } from './sync'

function serverTask(patch: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'task-a',
    title: 'Server task',
    description: '',
    completed: false,
    priority: 'none',
    due_date: '2026-09-08',
    list_id: null,
    tags: [],
    favorite: false,
    reminder: new Date(2026, 8, 8, 9).toISOString(),
    sort_order: 0,
    created_at: '2026-09-01T00:00:00.000Z',
    completed_at: null,
    updated_at: '2026-09-01T00:00:00.000Z',
    deleted_at: null,
    ...patch,
  }
}

function localTask(patch: Partial<Task> = {}): Task {
  return {
    id: 'task-a',
    title: 'Local task',
    description: '',
    completed: false,
    priority: 'none',
    dueDate: '2026-09-08',
    listId: null,
    tags: [],
    favorite: false,
    reminder: new Date(2026, 8, 8, 9).toISOString(),
    recurrence: null,
    recurrenceSeriesId: null,
    recurrenceSequence: null,
    sortOrder: 0,
    createdAt: '2026-09-01T00:00:00.000Z',
    completedAt: null,
    updatedAt: '2026-09-01T00:00:00.000Z',
    deletedAt: null,
    ...patch,
  }
}

describe('task recurrence sync mapping', () => {
  it('loads a pre-recurrence server row safely', () => {
    expect(rowToTask(serverTask())).toMatchObject({
      recurrence: null,
      recurrenceSeriesId: null,
      recurrenceSequence: null,
    })
  })

  it('round trips a selected-day recurrence', () => {
    const task = localTask({
      recurrence: { frequency: 'selectedDays', weekdays: [1, 3, 5] },
      recurrenceSeriesId: 'series-a',
      recurrenceSequence: 3,
    })
    expect(rowToTask(taskToRow(task, 'user-a'))).toMatchObject({
      recurrence: { frequency: 'selectedDays', weekdays: [1, 3, 5] },
      recurrenceSeriesId: 'series-a',
      recurrenceSequence: 3,
    })
  })

  it('drops malformed recurrence JSON and orphaned series from the server', () => {
    expect(
      rowToTask(
        serverTask({
          recurrence: { frequency: 'monthly', preferredDay: 45 },
          recurrence_series_id: 'orphan',
          recurrence_sequence: 2,
        }),
      ),
    ).toMatchObject({ recurrence: null, recurrenceSeriesId: null, recurrenceSequence: null })
  })

  it('drops invalid series metadata from an otherwise valid recurrence', () => {
    expect(
      rowToTask(
        serverTask({
          recurrence: { frequency: 'daily' },
          recurrence_series_id: 42,
          recurrence_sequence: -1,
        }),
      ),
    ).toMatchObject({
      recurrence: { frequency: 'daily' },
      recurrenceSeriesId: null,
      recurrenceSequence: null,
    })
  })
})
