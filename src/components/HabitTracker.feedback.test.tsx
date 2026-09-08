import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Habit } from '../types'
import { todayStr } from '../utils/dateUtils'
import { HabitTracker } from './HabitTracker'

const events = vi.hoisted(() => [] as string[])
const habitStore = vi.hoisted(() => ({
  habits: [] as Habit[],
  templates: [],
  addHabit: vi.fn(),
  updateHabit: vi.fn(),
  deleteHabit: vi.fn(),
  toggleCompletion: vi.fn(),
  adjustCompletion: vi.fn(() => events.push('mutate')),
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
// The history grids are unrelated to the card-to-handler interaction and make
// this boundary test render hundreds of calendar cells.
vi.mock('./HabitHeatmap', () => ({
  HabitHeatmap: () => null,
  HabitMonthRows: () => null,
  HeatmapLegend: () => null,
}))
vi.mock('../native/platform', () => ({
  nativeFeedback: (kind: string) => events.push(`feedback:${kind}`),
  nativeSelectionHaptic: () => events.push('feedback:selection'),
  nativeSuccessHaptic: () => events.push('feedback:success'),
  nativeWarningHaptic: vi.fn(),
}))

describe('HabitTracker counted-card feedback boundary', () => {
  beforeEach(() => {
    events.length = 0
    vi.clearAllMocks()
    const today = todayStr()
    habitStore.habits = [
      {
        id: 'habit-1',
        name: 'Read',
        description: '',
        repetitionType: 'daily',
        daysOfWeek: [],
        datesOfMonth: [],
        timesPerWeek: null,
        trackBy: 'count',
        dailyTarget: 3,
        color: '#3ddbf0',
        icon: '',
        targetStreak: null,
        reminderTime: null,
        createdAt: `${today}T00:00:00.000Z`,
        logs: { [today]: 2 },
        logNotes: {},
        lastCompleted: null,
        archivedAt: null,
        sortOrder: 0,
        source: 'manual',
      },
    ]
  })

  it('emits one success event before the counted-habit mutation', () => {
    render(<HabitTracker onOpenMobileNav={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'My Routines' })).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Read' }))
    expect(screen.getByRole('menu', { name: 'Routine actions' })).not.toBeNull()
    events.length = 0
    fireEvent.click(screen.getByRole('button', { name: /Log for Read/ }))

    expect(events).toEqual(['feedback:success', 'mutate'])
    expect(habitStore.adjustCompletion).toHaveBeenCalledTimes(1)
  })
})
