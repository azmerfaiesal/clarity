import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MOTION_MS } from '../utils/motion'
import { usePresenceValue } from './MotionPresence'

function Probe({ value, onExited }: { value: string | null; onExited: () => void }) {
  const presence = usePresenceValue(value, { onExited })
  return presence ? <div data-state={presence.phase}>{presence.value}</div> : null
}

describe('usePresenceValue', () => {
  afterEach(() => vi.useRealTimers())

  it('keeps the last value mounted through its exit before notifying', () => {
    vi.useFakeTimers()
    const onExited = vi.fn()
    const { rerender } = render(<Probe value="Calendar" onExited={onExited} />)

    rerender(<Probe value={null} onExited={onExited} />)

    expect(screen.getByText('Calendar').getAttribute('data-state')).toBe('exiting')
    act(() => vi.advanceTimersByTime(MOTION_MS.exit - 1))
    expect(screen.queryByText('Calendar')).not.toBeNull()

    act(() => vi.advanceTimersByTime(1))
    expect(screen.queryByText('Calendar')).toBeNull()
    expect(onExited).toHaveBeenCalledTimes(1)
  })

  it('cancels exit when the value is restored before the timeout', () => {
    vi.useFakeTimers()
    const onExited = vi.fn()
    const { rerender } = render(<Probe value="Calendar" onExited={onExited} />)

    rerender(<Probe value={null} onExited={onExited} />)
    rerender(<Probe value="Calendar" onExited={onExited} />)
    act(() => vi.advanceTimersByTime(MOTION_MS.exit))

    expect(screen.getByText('Calendar').getAttribute('data-state')).not.toBe('exiting')
    expect(onExited).not.toHaveBeenCalled()
  })
})
