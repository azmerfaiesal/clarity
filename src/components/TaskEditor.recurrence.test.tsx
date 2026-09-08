import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Task } from '../types'
import { TaskEditor } from './TaskEditor'

const task: Task = {
  id: 'task-a',
  title: 'Pay rent',
  description: '',
  completed: false,
  priority: 'medium',
  dueDate: '2026-01-31',
  listId: null,
  tags: [],
  favorite: false,
  reminder: new Date(2026, 0, 31, 9).toISOString(),
  recurrence: { frequency: 'monthly', preferredDay: 31 },
  recurrenceSeriesId: 'series-a',
  recurrenceSequence: 2,
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  completedAt: null,
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
}

describe('TaskEditor recurrence', () => {
  it('renders and saves an edited selected-day schedule', () => {
    const onSave = vi.fn()
    render(
      <TaskEditor
        task={task}
        lists={[]}
        onSave={onSave}
        onDelete={vi.fn()}
        onClose={vi.fn()}
        phase="entered"
      />,
    )

    const trigger = screen.getByRole('button', { name: /repeat: monthly on day 31/i })
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('radio', { name: 'Selected days' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Monday' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Wednesday' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        recurrence: { frequency: 'selectedDays', weekdays: [1, 3, 6] },
      }),
    )
  })

  it('saves no recurrence after both date anchors are cleared', () => {
    const onSave = vi.fn()
    render(
      <TaskEditor
        task={task}
        lists={[]}
        onSave={onSave}
        onDelete={vi.fn()}
        onClose={vi.fn()}
        phase="entered"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Clear due date' }))
    fireEvent.click(screen.getByRole('button', { name: 'Clear reminder' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ recurrence: null }))
  })
})
