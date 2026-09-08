import { describe, expect, it } from 'vitest'
import type { Task } from '../types'
import { tasksForView } from './taskUtils'

function task(patch: Partial<Task> = {}): Task {
  return {
    id: patch.id ?? crypto.randomUUID(),
    title: 'Task',
    description: '',
    completed: false,
    priority: 'none',
    dueDate: null,
    listId: null,
    tags: [],
    favorite: false,
    reminder: null,
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

describe('tasksForView', () => {
  it('keeps completed favorites out of the active Favorites list', () => {
    const active = task({ id: 'active', favorite: true })
    const completed = task({
      id: 'completed',
      favorite: true,
      completed: true,
      completedAt: '2026-09-01T01:00:00.000Z',
    })

    expect(tasksForView([active, completed], 'favorites')).toEqual([active])
  })

  it('keeps categorized tasks visible in the Inbox', () => {
    const categorized = task({ id: 'categorized', listId: 'work' })

    expect(tasksForView([categorized], 'inbox')).toEqual([categorized])
  })
})
