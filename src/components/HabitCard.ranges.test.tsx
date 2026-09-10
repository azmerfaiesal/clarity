import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Habit } from '../types'
import { HabitCard } from './HabitCard'

vi.mock('../store/theme', () => ({ useWeekStart: () => 1 }))
const rangeStorage = vi.hoisted(() => ({ saved: null as string | null }))

vi.mock('../store/storage', () => ({
  loadHabitRange: () => rangeStorage.saved,
  saveHabitRange: vi.fn(),
}))
vi.mock('../native/platform', () => ({
  nativeSelectionHaptic: vi.fn(),
  nativeSuccessHaptic: vi.fn(),
}))
vi.mock('./HabitHeatmap', () => ({
  HabitHeatmap: () => <div />,
  HabitMonthRows: () => <div />,
  HeatmapLegend: () => <div />,
}))

const habit: Habit = {
  id: 'routine-range-labels',
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

describe('HabitCard history labels', () => {
  beforeEach(() => {
    rangeStorage.saved = null
  })

  it('offers rolling month ranges instead of quarter and day-count labels', () => {
    render(
      <HabitCard
        habit={habit}
        onToggle={vi.fn()}
        onAdjust={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onArchive={vi.fn()}
        justCompleted={false}
        onSetAmount={vi.fn()}
        onSaveTemplate={vi.fn()}
        onOpenSummary={vi.fn()}
        onPickDay={vi.fn()}
        onSetNotes={vi.fn()}
      />,
    )

    expect(screen.getByRole('radio', { name: 'This month' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Last 4 months' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Last 12 months' })).toBeTruthy()
    expect(screen.queryByRole('radio', { name: 'This quarter' })).toBeNull()
    expect(screen.queryByRole('radio', { name: 'Last 365 days' })).toBeNull()
  })

  it.each([
    ['quarter', 'Last 4 months'],
    ['year', 'Last 12 months'],
  ])('maps the legacy %s preference to %s', (saved, selectedLabel) => {
    rangeStorage.saved = saved
    render(
      <HabitCard
        habit={habit}
        onToggle={vi.fn()}
        onAdjust={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onArchive={vi.fn()}
        justCompleted={false}
        onSetAmount={vi.fn()}
        onSaveTemplate={vi.fn()}
        onOpenSummary={vi.fn()}
        onPickDay={vi.fn()}
        onSetNotes={vi.fn()}
      />,
    )

    expect(screen.getByRole('radio', { name: selectedLabel }).getAttribute('aria-checked')).toBe(
      'true',
    )
  })
})
