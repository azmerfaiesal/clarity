import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
  HabitMonthRows: ({
    onPickDay,
  }: {
    onPickDay?: (date: string, anchor: { x: number; y: number }) => void
  }) => (
    <button type="button" onClick={() => onPickDay?.('2026-09-11', { x: 180, y: 320 })}>
      Pick September 11
    </button>
  ),
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

  afterEach(() => {
    vi.restoreAllMocks()
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

  it('transitions the card from its captured height to the selected range height', () => {
    rangeStorage.saved = 'month'
    let frameCallback: FrameRequestCallback | null = null
    const measuredHeights: number[] = []
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this.dataset.clarityEntity === 'routine:routine-range-labels') {
        const height = measuredHeights.length === 0 ? 240 : 420
        measuredHeights.push(height)
        return new DOMRect(0, 0, 864, height)
      }
      return new DOMRect()
    })
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frameCallback = callback
      return 101
    })

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

    fireEvent.click(screen.getByRole('radio', { name: 'Last 4 months' }))

    const card = screen.getByRole('article')
    expect(screen.getByRole('radio', { name: 'Last 4 months' }).getAttribute('aria-checked')).toBe(
      'true',
    )
    expect(measuredHeights).toEqual([240, 420])
    expect(frameCallback).not.toBeNull()
    expect(card.style.height).toBe('240px')
    expect(card.dataset.rangeMotion).toBe('running')

    ;(frameCallback as unknown as FrameRequestCallback)(0)
    expect(card.style.height).toBe('420px')
  })

  it('attaches visible detail-rail bounds to a clicked day on wide cards', () => {
    const onPickDay = vi.fn()
    const { container } = render(
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
        onPickDay={onPickDay}
        onSetNotes={vi.fn()}
      />,
    )

    const card = container.querySelector('[data-clarity-entity="routine:routine-range-labels"]')
    const rail = container.querySelector('[data-routine-detail-rail]') as HTMLDivElement | null
    expect(card?.classList).toContain('routine-card')
    expect(rail).not.toBeNull()
    vi.spyOn(rail as HTMLDivElement, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(640, 210, 240, 190),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Pick September 11' }))

    expect(onPickDay).toHaveBeenCalledWith('2026-09-11', {
      x: 180,
      y: 320,
      rail: { left: 640, top: 210, width: 240, height: 190 },
    })
  })
})
