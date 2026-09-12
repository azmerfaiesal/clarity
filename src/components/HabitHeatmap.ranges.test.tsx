import { render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Habit } from '../types'
import { HabitMonthRows } from './HabitHeatmap'

const layout = vi.hoisted(() => ({ native: true, narrow: true }))

vi.mock('../utils/useMediaQuery', () => ({ useMediaQuery: () => layout.narrow }))
vi.mock('../native/platform', () => ({
  get isNativeApp() {
    return layout.native
  },
}))

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
  beforeEach(() => {
    layout.native = true
    layout.narrow = true
  })

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

    expect(screen.getAllByRole('group', { name: /history$/ })).toHaveLength(12)
    expect(screen.getByRole('button', { name: '2025-10-01 — open day' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '2026-09-30 — open day' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '2025-09-30 — open day' })).toBeNull()
  })

  it('lays native multi-month history out as Monday-to-Sunday rows and week columns', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 9, 12))

    render(<HabitMonthRows habit={habit} span="fourMonths" />)

    const scroller = screen.getByRole('region', { name: 'Routine history by month' })
    expect(scroller.className).toContain('overflow-x-auto')
    expect(screen.getAllByRole('group', { name: /history$/ })).toHaveLength(4)

    const september = screen.getByRole('group', { name: 'September 2026 history' })
    expect(within(september).getByText('September 2026')).toBeTruthy()
    expect(within(september).getByText('Mon')).toBeTruthy()
    expect(within(september).getByText('Sun')).toBeTruthy()

    const grid = september.querySelector('[data-native-month-grid]') as HTMLElement
    expect(grid.style.gridTemplateRows).toBe('repeat(7, 12px)')
    expect(grid.style.gridAutoFlow).toBe('column')
    expect(grid.children[0].getAttribute('aria-hidden')).toBe('true')
    expect(grid.children[1].getAttribute('aria-label')).toBe('2026-09-01 — open day')
    expect(grid.children[6].getAttribute('aria-label')).toBe('2026-09-06 — open day')
    expect(grid.children[7].getAttribute('aria-label')).toBe('2026-09-07 — open day')
  })

  it('keeps the existing browser layout outside native iOS', () => {
    layout.native = false
    layout.narrow = false
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 9, 12))

    render(<HabitMonthRows habit={habit} span="fourMonths" />)

    expect(screen.queryByRole('region', { name: 'Routine history by month' })).toBeNull()
    expect(screen.getByRole('button', { name: '2026-06-01 — open day' })).toBeTruthy()
  })
})
