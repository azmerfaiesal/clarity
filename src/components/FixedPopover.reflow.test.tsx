import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { BrainDump, Habit } from '../types'
import { DayDetail } from './DayDetail'
import { Dropdown } from './Dropdown'
import { NoteDayDetail } from './NoteDayDetail'

vi.mock('../store/theme', () => ({ useWeekStart: () => 1 }))

const date = '2026-09-04'

const habit: Habit = {
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
  createdAt: '2026-09-01T08:00:00.000Z',
  logs: { [date]: 1 },
  logNotes: {},
  lastCompleted: null,
  archivedAt: null,
  sortOrder: 0,
  source: 'manual',
}

const note: BrainDump = {
  id: 'note-1',
  content: 'A note',
  tags: [],
  createdAt: '2026-09-04T08:00:00.000Z',
  updatedAt: '2026-09-04T08:00:00.000Z',
}

describe('fixed popover viewport changes', () => {
  it.each([
    ['resize', DayDetail],
    ['orientationchange', DayDetail],
  ] as const)('closes Day Detail on %s', (eventName, Component) => {
    const onClose = vi.fn()
    render(
      <Component
        habit={habit}
        date={date}
        today={date}
        anchor={{ x: 100, y: 100 }}
        editable={false}
        onSetNotes={vi.fn()}
        onClose={onClose}
        phase="entered"
      />,
    )

    fireEvent(window, new Event(eventName))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it.each(['resize', 'orientationchange'])('closes Note Day Detail on %s', (eventName) => {
    const onClose = vi.fn()
    render(
      <NoteDayDetail
        date={date}
        notes={[note]}
        anchor={{ x: 100, y: 100 }}
        onOpenNote={vi.fn()}
        onClose={onClose}
        phase="entered"
      />,
    )

    fireEvent(window, new Event(eventName))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes Dropdown on orientation change', () => {
    render(
      <Dropdown
        label="Actions"
        trigger={({ toggle }) => <button onClick={toggle}>Open actions</button>}
      >
        {() => <button role="menuitem">Action</button>}
      </Dropdown>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Open actions' }))

    fireEvent(window, new Event('orientationchange'))

    expect(screen.getByRole('menu', { name: 'Actions' }).dataset.motionState).toBe('exiting')
  })
})
