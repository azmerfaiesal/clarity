import { render, screen } from '@testing-library/react'
import type { RefObject } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Habit } from '../types'
import { HabitSummary } from './HabitSummary'

vi.mock('../store/theme', () => ({ useWeekStart: () => 1 }))

const habit: Habit = {
  id: 'routine-summary-anchor',
  name: 'Read What You Love',
  description: '',
  repetitionType: 'daily',
  daysOfWeek: [],
  datesOfMonth: [],
  timesPerWeek: null,
  trackBy: 'duration',
  dailyTarget: 30,
  color: '#ff8a3d',
  icon: 'book-open',
  targetStreak: null,
  reminderTime: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  logs: {},
  logNotes: {},
  lastCompleted: null,
  archivedAt: null,
  sortOrder: 0,
  source: 'manual',
}

describe('HabitSummary title origin', () => {
  afterEach(() => vi.restoreAllMocks())

  it('portals the summary and measures its motion from the clicked title', () => {
    const anchor = document.createElement('button')
    const anchorRef: RefObject<HTMLElement | null> = { current: anchor }
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this === anchor) return new DOMRect(300, 700, 44, 44)
      if (this.getAttribute('role') === 'dialog') return new DOMRect(20, 100, 340, 500)
      return new DOMRect()
    })

    const { container } = render(
      <HabitSummary
        habit={habit}
        onClose={vi.fn()}
        phase="entering"
        anchorRef={anchorRef}
      />,
    )

    const dialog = screen.getByRole('dialog', { name: 'Read What You Love summary' })
    expect(dialog.classList.contains('routine-summary-modal')).toBe(true)
    expect(dialog.style.getPropertyValue('--composer-anchor-x')).toBe('132px')
    expect(dialog.style.getPropertyValue('--composer-anchor-y')).toBe('372px')

    const viewport = dialog.closest('.routine-summary-viewport')
    expect(viewport).not.toBeNull()
    expect(viewport?.parentElement).toBe(document.body)
    expect(container.contains(dialog)).toBe(false)
  })
})
