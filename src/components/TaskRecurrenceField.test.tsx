import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TaskRecurrenceField } from './TaskRecurrenceField'

describe('TaskRecurrenceField', () => {
  const anchor = new Date(2026, 8, 8, 9)

  it('selects multiple weekdays from Monday through Sunday', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <TaskRecurrenceField value={null} anchor={anchor} onChange={onChange} />,
    )

    fireEvent.click(screen.getByRole('button', { name: /repeat/i }))
    fireEvent.click(screen.getByRole('radio', { name: 'Selected days' }))
    expect(onChange).toHaveBeenLastCalledWith({ frequency: 'selectedDays', weekdays: [2] })

    rerender(
      <TaskRecurrenceField
        value={{ frequency: 'selectedDays', weekdays: [2] }}
        anchor={anchor}
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByRole('checkbox', { name: 'Monday' }))
    expect(onChange).toHaveBeenLastCalledWith({ frequency: 'selectedDays', weekdays: [1, 2] })

    rerender(
      <TaskRecurrenceField
        value={{ frequency: 'selectedDays', weekdays: [1, 2] }}
        anchor={anchor}
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByRole('checkbox', { name: 'Wednesday' }))
    expect(onChange).toHaveBeenLastCalledWith({ frequency: 'selectedDays', weekdays: [1, 2, 3] })
    expect(screen.getByTestId('task-repeat-panel').classList.contains('motion-repeat-panel')).toBe(
      true,
    )
  })

  it('keeps one selected weekday and explains why it cannot be removed', () => {
    const onChange = vi.fn()
    render(
      <TaskRecurrenceField
        value={{ frequency: 'selectedDays', weekdays: [2] }}
        anchor={anchor}
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /repeat/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Tuesday' }))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByText('Choose at least one day.')).not.toBeNull()
  })

  it('disables recurrence until a due date or reminder exists', () => {
    render(<TaskRecurrenceField value={null} anchor={null} onChange={vi.fn()} />)
    expect((screen.getByRole('button', { name: /repeat/i }) as HTMLButtonElement).disabled).toBe(
      true,
    )
    expect(screen.getByText('Add a due date or reminder first.')).not.toBeNull()
  })

  it('derives weekly and monthly defaults from the anchor', () => {
    const onChange = vi.fn()
    render(<TaskRecurrenceField value={null} anchor={anchor} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /repeat/i }))
    fireEvent.click(screen.getByRole('radio', { name: 'Weekly' }))
    expect(onChange).toHaveBeenLastCalledWith({ frequency: 'weekly' })
    fireEvent.click(screen.getByRole('radio', { name: 'Monthly' }))
    expect(onChange).toHaveBeenLastCalledWith({ frequency: 'monthly', preferredDay: 8 })
  })

  it('closes its disclosure with Escape', () => {
    render(<TaskRecurrenceField value={null} anchor={anchor} onChange={vi.fn()} />)
    const trigger = screen.getByRole('button', { name: /repeat/i })
    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    fireEvent.keyDown(screen.getByTestId('task-repeat-field'), { key: 'Escape' })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })
})
