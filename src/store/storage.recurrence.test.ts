import { beforeEach, describe, expect, it } from 'vitest'
import { loadTasks } from './storage'

describe('task cache recurrence migration', () => {
  beforeEach(() => localStorage.clear())

  it('loads a pre-recurrence task with safe null defaults', () => {
    localStorage.setItem(
      'clarity.v2.tasks:local',
      JSON.stringify([
        {
          id: 'old-task',
          title: 'Old task',
          description: '',
          completed: false,
          priority: 'none',
          dueDate: null,
          listId: null,
          tags: [],
          favorite: false,
          reminder: null,
          sortOrder: 0,
          createdAt: '2026-09-01T00:00:00.000Z',
          completedAt: null,
          updatedAt: '2026-09-01T00:00:00.000Z',
          deletedAt: null,
        },
      ]),
    )

    expect(loadTasks('local')?.[0]).toMatchObject({
      recurrence: null,
      recurrenceSeriesId: null,
      recurrenceSequence: null,
    })
  })
})
