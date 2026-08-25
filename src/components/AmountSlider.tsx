import { useEffect, useRef, useState } from 'react'
import type { Habit } from '../types'
import { formatAmount, requiredPerDay } from '../utils/habitUtils'

/**
 * Press-and-hold surface for logging an exact amount.
 *
 * Holding the log button opens this; dragging picks the value and releasing
 * commits it. The range runs to 1.5× the target so overshooting a goal is
 * possible without the slider pinning at the top.
 */
export function AmountSlider({
  habit,
  initial,
  onCommit,
  onClose,
}: {
  habit: Habit
  initial: number
  onCommit: (value: number) => void
  onClose: () => void
}) {
  const need = requiredPerDay(habit)
  const max = Math.max(need * 1.5, need + 1)
  const step = habit.trackBy === 'duration' ? 5 : 1
  const [value, setValue] = useState(initial)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [onClose])

  const pct = Math.min(100, (value / max) * 100)
  const reached = value >= need

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`Set amount for ${habit.name}`}
      className="anim-scale-in absolute top-full left-0 z-40 mt-2 w-56 rounded-xl border border-line bg-raised p-3 shadow-2xl shadow-black/30 dark:shadow-black/70"
    >
      <div className="mb-2 flex items-baseline justify-between">
        <span
          className="font-mono text-lg font-semibold tabular-nums"
          style={{ color: reached ? habit.color : undefined }}
        >
          {formatAmount(habit, value)}
        </span>
        <span className="font-mono text-3xs text-faint">
          of {formatAmount(habit, need)}
        </span>
      </div>

      {/* Native range: keyboard and screen-reader support for free. */}
      <div className="relative">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
          <div
            className="h-full rounded-full transition-[width] duration-100"
            style={{ width: `${pct}%`, backgroundColor: habit.color }}
          />
        </div>
        <input
          type="range"
          min={0}
          max={max}
          step={step}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          aria-label={`Amount for ${habit.name}`}
          className="absolute inset-0 h-1.5 w-full cursor-pointer opacity-0"
        />
        <span
          className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-raised shadow"
          style={{ left: `${pct}%`, backgroundColor: habit.color }}
          aria-hidden
        />
      </div>

      <div className="mt-3 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setValue(need)}
          className="cursor-pointer rounded border border-line px-2 py-1 font-mono text-3xs text-muted transition-colors hover:text-ink"
        >
          target
        </button>
        <button
          type="button"
          onClick={() => setValue(0)}
          className="cursor-pointer rounded border border-line px-2 py-1 font-mono text-3xs text-muted transition-colors hover:text-ink"
        >
          clear
        </button>
        <button
          type="button"
          onClick={() => {
            onCommit(value)
            onClose()
          }}
          className="ml-auto cursor-pointer rounded-md px-2.5 py-1 text-3xs font-medium text-accent-ink transition-opacity hover:opacity-90"
          style={{ backgroundColor: habit.color }}
        >
          Log
        </button>
      </div>
    </div>
  )
}
