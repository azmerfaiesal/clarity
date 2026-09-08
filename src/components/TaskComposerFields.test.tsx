import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TaskComposerFields } from './TaskComposerFields'

function expectMotionInteractive(element: Element) {
  expect(element.classList.contains('motion-interactive')).toBe(true)
}

describe('TaskComposerFields motion class contract', () => {
  it('applies shared interaction motion to date, priority, clear, and action controls', () => {
    render(
      <TaskComposerFields
        lists={[]}
        defaultDueDate="2026-09-04"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expectMotionInteractive(screen.getByLabelText('Due date').closest('label')!)
    expectMotionInteractive(screen.getByRole('button', { name: 'Today' }))
    expectMotionInteractive(screen.getByRole('button', { name: 'Tomorrow' }))
    expectMotionInteractive(screen.getByRole('button', { name: 'Clear due date' }))
    for (const priority of screen.getAllByRole('radio')) expectMotionInteractive(priority)
    expectMotionInteractive(screen.getByRole('button', { name: 'Cancel' }))

    const add = screen.getByRole('button', { name: 'Add task' })
    expectMotionInteractive(add)
    expect(add.classList.contains('motion-primary')).toBe(true)

    fireEvent.change(screen.getByLabelText('Reminder'), {
      target: { value: '2026-09-04T09:30' },
    })
    expectMotionInteractive(screen.getByRole('button', { name: 'Clear reminder' }))
  })

  it('submits a selected weekday recurrence', () => {
    const onSubmit = vi.fn()
    render(
      <TaskComposerFields
        lists={[]}
        defaultDueDate="2026-09-04"
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByLabelText('Task name'), { target: { value: 'Training' } })
    fireEvent.click(screen.getByRole('button', { name: /repeat/i }))
    fireEvent.click(screen.getByRole('radio', { name: 'Selected days' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Monday' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Wednesday' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Friday' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add task' }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        recurrence: { frequency: 'selectedDays', weekdays: [1, 3] },
      }),
    )
  })

  it('clears recurrence when the final schedule anchor is removed', () => {
    const onSubmit = vi.fn()
    render(
      <TaskComposerFields
        lists={[]}
        defaultDueDate="2026-09-04"
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByLabelText('Task name'), { target: { value: 'Training' } })
    fireEvent.click(screen.getByRole('button', { name: /repeat/i }))
    fireEvent.click(screen.getByRole('radio', { name: 'Daily' }))
    fireEvent.click(screen.getByRole('button', { name: 'Clear due date' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add task' }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ recurrence: null }))
  })
})
