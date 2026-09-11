import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Habit } from '../types'
import { DayDetail } from './DayDetail'

vi.mock('../store/theme', () => ({ useWeekStart: () => 1 }))

const habit: Habit = {
  id: 'routine-day-detail',
  name: 'Read',
  description: '',
  repetitionType: 'daily',
  daysOfWeek: [],
  datesOfMonth: [],
  timesPerWeek: null,
  trackBy: 'checkoff',
  dailyTarget: null,
  color: '#ff8a3d',
  icon: '',
  targetStreak: null,
  reminderTime: null,
  createdAt: '2025-01-01T00:00:00.000Z',
  logs: { '2026-09-11': 1 },
  logNotes: {},
  lastCompleted: '2026-09-11',
  archivedAt: null,
  sortOrder: 0,
  source: 'manual',
}

function renderDetail(anchor: React.ComponentProps<typeof DayDetail>['anchor']) {
  return render(
    <DayDetail
      habit={habit}
      date="2026-09-11"
      today="2026-09-11"
      anchor={anchor}
      editable
      onSetNotes={vi.fn()}
      onClose={vi.fn()}
      phase="entered"
    />,
  )
}

describe('DayDetail responsive placement', () => {
  afterEach(() => vi.restoreAllMocks())

  it('aligns a wide-card detail rail panel with the clicked Routine row', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 240, 160),
    )

    renderDetail({
      x: 420,
      y: 360,
      rail: { left: 640, top: 210, width: 240, height: 360 },
    })

    const dialog = screen.getByRole('dialog', { name: 'Read on 2026-09-11' })
    await waitFor(() => expect(dialog.dataset.placement).toBe('rail'))
    expect(dialog.style.left).toBe('640px')
    expect(dialog.style.top).toBe('360px')
  })

  it('keeps the safe fixed popover when no wide rail is available', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 240, 160),
    )

    renderDetail({ x: 180, y: 320 })

    const dialog = screen.getByRole('dialog', { name: 'Read on 2026-09-11' })
    await waitFor(() => expect(dialog.dataset.placement).toBe('popover'))
    expect(dialog.style.visibility).toBe('visible')
  })
})
