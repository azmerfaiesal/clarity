import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Habit } from '../types'
import { HabitMonthRows } from './HabitHeatmap'

vi.mock('../utils/useMediaQuery', () => ({ useMediaQuery: () => true }))

const habit: Habit = {
  id: 'routine-month-window',
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
  logs: {},
  logNotes: {},
  lastCompleted: null,
  archivedAt: null,
  sortOrder: 0,
  source: 'manual',
}

describe('HabitMonthRows rolling calendar windows', () => {
  afterEach(() => vi.useRealTimers())

  it('shows four complete calendar months ending in the current month', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 9, 12))

    render(<HabitMonthRows habit={habit} span="fourMonths" />)

    expect(screen.getByRole('button', { name: '2026-06-01 — open day' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '2026-09-30 — open day' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '2026-05-31 — open day' })).toBeNull()
  })

  it('shows twelve complete calendar months across a year boundary', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 9, 12))

    render(<HabitMonthRows habit={habit} span="twelveMonths" />)

    expect(screen.getByRole('button', { name: '2025-10-01 — open day' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '2026-09-30 — open day' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '2025-09-30 — open day' })).toBeNull()
  })
})
