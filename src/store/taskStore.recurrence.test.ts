import { describe, expect, it } from 'vitest'
import type { Task } from '../types'
import { taskReducer, type TaskAction, type TaskState } from './taskStore'

function recurringTask(patch: Partial<Task> = {}): Task {
  return {
    id: 'current',
    title: 'Pay rent',
    description: 'Apartment',
    completed: false,
    priority: 'high',
    dueDate: '2026-09-08',
    listId: 'personal',
    tags: ['money'],
    favorite: true,
    reminder: new Date(2026, 8, 8, 9).toISOString(),
    recurrence: { frequency: 'daily' },
    recurrenceSeriesId: 'series-a',
    recurrenceSequence: 0,
    sortOrder: 10,
    createdAt: '2026-09-01T00:00:00.000Z',
    completedAt: null,
    updatedAt: '2026-09-01T00:00:00.000Z',
    deletedAt: null,
    ...patch,
  }
}

function stateWith(...tasks: Task[]): TaskState {
  return { scope: 'local', tasks, lists: [], lastDeleted: null, ready: true }
}

const completionAction: TaskAction = {
  type: 'TOGGLE_COMPLETE',
  id: 'current',
  now: new Date(2026, 8, 8, 12).toISOString(),
}

describe('recurring task store behavior', () => {
  it('completes the current task and appends one next occurrence', () => {
    const next = taskReducer(stateWith(recurringTask()), completionAction)

    expect(next.tasks.find((task) => task.id === 'current')).toMatchObject({
      completed: true,
      completedAt: completionAction.now,
    })
    expect(next.tasks.filter((task) => !task.completed)).toHaveLength(1)
    expect(next.tasks[1]).toMatchObject({
      id: 'rec:series-a:1',
      title: 'Pay rent',
      description: 'Apartment',
      priority: 'high',
      dueDate: '2026-09-09',
      listId: 'personal',
      tags: ['money'],
      favorite: true,
      recurrenceSeriesId: 'series-a',
      recurrenceSequence: 1,
      completed: false,
      completedAt: null,
      deletedAt: null,
    })
  })

  it('does not create another occurrence when reopening history', () => {
    const next = taskReducer(
      stateWith(
        recurringTask({ completed: true, completedAt: '2026-09-08T04:00:00.000Z' }),
      ),
      completionAction,
    )
    expect(next.tasks).toHaveLength(1)
    expect(next.tasks[0].completed).toBe(false)
  })

  it('converges on one deterministic next occurrence', () => {
    const first = taskReducer(stateWith(recurringTask()), completionAction)
    const second = taskReducer(stateWith(recurringTask()), completionAction)
    expect(first.tasks[1].id).toBe(second.tasks[1].id)
  })

  it('does not append a next occurrence that already exists', () => {
    const existing = recurringTask({ id: 'rec:series-a:1', recurrenceSequence: 1 })
    const next = taskReducer(stateWith(recurringTask(), existing), completionAction)
    expect(next.tasks.filter((task) => task.id === 'rec:series-a:1')).toHaveLength(1)
  })

  it('assigns a series when recurrence is enabled and clears it when cancelled', () => {
    const source = recurringTask({
      recurrence: null,
      recurrenceSeriesId: null,
      recurrenceSequence: null,
    })
    const enabled = taskReducer(stateWith(source), {
      type: 'UPDATE_TASK',
      id: source.id,
      patch: { recurrence: { frequency: 'weekly' } },
    })
    expect(enabled.tasks[0].recurrenceSeriesId).toEqual(expect.any(String))
    expect(enabled.tasks[0].recurrenceSequence).toBe(0)

    const cancelled = taskReducer(enabled, {
      type: 'UPDATE_TASK',
      id: source.id,
      patch: { recurrence: null },
    })
    expect(cancelled.tasks[0]).toMatchObject({
      recurrence: null,
      recurrenceSeriesId: null,
      recurrenceSequence: null,
    })
  })

  it('clears recurrence when its final date anchor is removed', () => {
    const next = taskReducer(
      stateWith(recurringTask({ dueDate: null })),
      { type: 'UPDATE_TASK', id: 'current', patch: { reminder: null } },
    )
    expect(next.tasks[0]).toMatchObject({
      recurrence: null,
      recurrenceSeriesId: null,
      recurrenceSequence: null,
    })
  })

  it('duplicates a recurring task as an independent series', () => {
    const next = taskReducer(stateWith(recurringTask()), { type: 'DUPLICATE_TASK', id: 'current' })
    expect(next.tasks).toHaveLength(2)
    expect(next.tasks[1].recurrence).toEqual({ frequency: 'daily' })
    expect(next.tasks[1].recurrenceSeriesId).not.toBe('series-a')
    expect(next.tasks[1].recurrenceSequence).toBe(0)
  })

  it('does not generate from deleted or malformed recurring tasks', () => {
    const deleted = taskReducer(
      stateWith(recurringTask({ deletedAt: '2026-09-08T01:00:00.000Z' })),
      completionAction,
    )
    expect(deleted.tasks).toHaveLength(1)

    const malformed = taskReducer(
      stateWith(recurringTask({ recurrence: { frequency: 'selectedDays', weekdays: [] } })),
      completionAction,
    )
    expect(malformed.tasks).toHaveLength(1)
  })
})
