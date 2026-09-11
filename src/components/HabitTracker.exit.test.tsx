import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HabitTemplate } from '../types'
import { HabitTracker } from './HabitTracker'

const habitStore = vi.hoisted(() => ({
  habits: [],
  templates: [],
  addHabit: vi.fn(),
  updateHabit: vi.fn(),
  deleteHabit: vi.fn(),
  toggleCompletion: vi.fn(),
  adjustCompletion: vi.fn(),
  setAmount: vi.fn(),
  setArchived: vi.fn(),
  reorderHabits: vi.fn(),
  setLogNotes: vi.fn(),
  saveAsTemplate: vi.fn(),
  updateTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
}))

vi.mock('../store/habitStore', () => ({ useHabits: () => habitStore }))
vi.mock('../store/theme', () => ({ useWeekStart: () => 1 }))

const template: HabitTemplate = {
  id: 'template-reading',
  name: 'Read for 20 minutes',
  description: '',
  icon: 'book-open',
  color: '#a7f3d0',
  repetitionType: 'daily',
  daysOfWeek: [],
  datesOfMonth: [],
  timesPerWeek: null,
  trackBy: 'duration',
  dailyTarget: 20,
  createdAt: '2026-09-04T00:00:00.000Z',
}

describe('HabitTracker exiting form boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('restores focus to the add button after its composer collapses', () => {
    vi.useFakeTimers()
    render(<HabitTracker onOpenMobileNav={vi.fn()} />)

    const addButton = screen.getByRole('button', { name: 'New routine' })
    expect(addButton.classList.contains('h-[30px]')).toBe(true)
    expect(addButton.classList.contains('w-11')).toBe(true)
    fireEvent.click(addButton)
    const dialog = screen.getByRole('dialog', { name: 'New routine' })
    expect(dialog).not.toBeNull()
    expect(dialog.parentElement?.classList).toContain('global-composer-viewport')
    expect(dialog.classList).toContain('global-composer-modal')

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    act(() => vi.advanceTimersByTime(300))

    expect(screen.queryByRole('dialog', { name: 'New routine' })).toBeNull()
    expect(document.activeElement).toBe(addButton)
  })

  it('does not turn a closing template edit into a new habit when Enter is pressed', async () => {
    const onTemplateHandled = vi.fn()
    const props = {
      onOpenMobileNav: vi.fn(),
      onTemplateHandled,
    }
    const { rerender } = render(<HabitTracker {...props} editTemplate={template} />)

    const nameInput = await screen.findByLabelText('Routine name')
    const dialog = screen.getByRole('dialog', { name: 'Edit template' })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    rerender(<HabitTracker {...props} editTemplate={null} />)

    await waitFor(() => {
      expect(document.querySelector('.motion-overlay')?.getAttribute('data-motion-state')).toBe(
        'exiting',
      )
    })
    expect(dialog.hasAttribute('inert')).toBe(true)
    fireEvent.keyDown(nameInput, { key: 'Enter' })

    expect(habitStore.addHabit).not.toHaveBeenCalled()
    expect(habitStore.updateHabit).not.toHaveBeenCalled()
    expect(habitStore.updateTemplate).not.toHaveBeenCalled()
  })
})
