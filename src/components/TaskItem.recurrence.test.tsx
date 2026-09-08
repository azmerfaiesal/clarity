import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Task } from '../types'
import { TaskItem } from './TaskItem'

const task: Task = {
  id: 'task-a',
  title: 'Training',
  description: '',
  completed: false,
  priority: 'none',
  dueDate: null,
  listId: null,
  tags: [],
  favorite: false,
  reminder: new Date(2026, 8, 7, 8).toISOString(),
  recurrence: { frequency: 'selectedDays', weekdays: [1, 3, 5] },
  recurrenceSeriesId: 'series-a',
  recurrenceSequence: 0,
  sortOrder: 0,
  createdAt: '2026-09-01T00:00:00.000Z',
  completedAt: null,
  updatedAt: '2026-09-01T00:00:00.000Z',
  deletedAt: null,
}

describe('TaskItem recurrence', () => {
  it('shows an accessible recurrence summary', () => {
    render(
      <TaskItem
        task={task}
        lists={[]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onToggleComplete={vi.fn()}
        onToggleFavorite={vi.fn()}
        onDuplicate={vi.fn()}
      />,
    )
    expect(screen.getByLabelText('Repeats every Monday, Wednesday and Friday')).not.toBeNull()
  })

  it('renders the metadata row when recurrence is the only metadata', () => {
    render(
      <TaskItem
        task={{ ...task, reminder: null, dueDate: '2026-09-07' }}
        lists={[]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onToggleComplete={vi.fn()}
        onToggleFavorite={vi.fn()}
        onDuplicate={vi.fn()}
      />,
    )
    expect(screen.getByLabelText('Repeats every Monday, Wednesday and Friday')).not.toBeNull()
  })
})
