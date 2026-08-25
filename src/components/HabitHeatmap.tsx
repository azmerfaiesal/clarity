import { useMemo } from 'react'
import type { Habit } from '../types'
import { addDays, parseDate, todayStr } from '../utils/dateUtils'
import { isScheduled, weekStart } from '../utils/habitUtils'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

type CellState = 'future' | 'untracked' | 'notdue' | 'missed' | 'done'

/**
 * A year of the habit at a glance, laid out the way contribution graphs are:
 * one column per week, Sunday at the top, oldest week on the left.
 *
 * Three tones rather than the usual two. A day the habit was never due looks
 * different from one it was due and missed — without that, a Mon/Wed/Fri habit
 * would read as though it had failed four days out of every seven.
 */
export function HabitHeatmap({ habit, cell = 12 }: { habit: Habit; cell?: number }) {
  const today = todayStr()

  const { weeks, months } = useMemo(() => {
    // 53 columns ending on the week containing today.
    const start = weekStart(addDays(today, -364))
    const created = habit.createdAt.slice(0, 10)
    const done = new Set(habit.completedDates)

    const weeks: { date: string; state: CellState }[][] = []
    let cursor = start
    while (cursor <= today || parseDate(cursor).getDay() !== 0) {
      const week: { date: string; state: CellState }[] = []
      for (let d = 0; d < 7; d++) {
        const date = cursor
        let state: CellState
        // Days before the habit existed still draw, faintly — a grid with a
        // hole in it reads as broken rather than as "not tracked yet".
        if (date > today) state = 'future'
        else if (date < created) state = 'untracked'
        else if (done.has(date)) state = 'done'
        else if (isScheduled(habit, date)) state = 'missed'
        else state = 'notdue'
        week.push({ date, state })
        cursor = addDays(cursor, 1)
      }
      weeks.push(week)
      if (weeks.length > 54) break
    }

    // Label a column when its month differs from the column before it.
    const months = weeks.map((w, i) => {
      const m = parseDate(w[0].date).getMonth()
      if (i === 0) return null
      const prev = parseDate(weeks[i - 1][0].date).getMonth()
      return m !== prev ? MONTHS[m] : null
    })

    return { weeks, months }
  }, [habit, today])

  const gap = Math.max(2, Math.round(cell / 4))
  const col = `${cell}px`

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex gap-1.5 pb-1">
        {/* Weekday gutter */}
        <div
          className="grid shrink-0 pt-[var(--month-h)]"
          style={
            {
              gridTemplateRows: `repeat(7, ${col})`,
              gap: `${gap}px`,
              '--month-h': `${cell + gap + 2}px`,
            } as React.CSSProperties
          }
        >
          {['', 'Mon', '', 'Wed', '', 'Fri', ''].map((d, i) => (
            <span
              key={i}
              className="flex items-center pr-1 font-mono text-faint"
              style={{ fontSize: Math.max(8, cell - 2), lineHeight: 1 }}
            >
              {d}
            </span>
          ))}
        </div>

        <div>
          {/* Month labels, one slot per week column */}
          <div
            className="grid"
            style={{ gridAutoFlow: 'column', gridAutoColumns: col, gap: `${gap}px` }}
          >
            {months.map((m, i) => (
              <span
                key={i}
                className="font-mono whitespace-nowrap text-faint"
                style={{ fontSize: Math.max(8, cell - 2), lineHeight: `${cell + gap + 2}px` }}
              >
                {m ?? ''}
              </span>
            ))}
          </div>

          {/* The grid itself */}
          <div
            className="grid"
            style={{
              gridAutoFlow: 'column',
              gridAutoColumns: col,
              gridTemplateRows: `repeat(7, ${col})`,
              gap: `${gap}px`,
            }}
          >
            {weeks.flat().map(({ date, state }) => (
              <div
                key={date}
                title={
                  state === 'future'
                    ? undefined
                    : `${date} · ${
                        state === 'done'
                          ? 'done'
                          : state === 'missed'
                            ? 'missed'
                            : state === 'untracked'
                              ? 'not tracked'
                              : 'not due'
                      }`
                }
                className={`rounded-[2px] ${
                  state === 'future'
                    ? 'opacity-0'
                    : state === 'done'
                      ? ''
                      : state === 'missed'
                        ? 'bg-line-strong/60'
                        : state === 'untracked'
                          ? 'bg-line/35'
                          : 'bg-line/60'
                }`}
                style={state === 'done' ? { backgroundColor: habit.color } : undefined}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function HeatmapLegend({ color }: { color: string }) {
  return (
    <span className="flex items-center gap-1.5 font-mono text-3xs text-faint">
      <span className="h-2.5 w-2.5 rounded-[2px] bg-line/60" aria-hidden />
      Not due
      <span className="ml-1 h-2.5 w-2.5 rounded-[2px] bg-line-strong/60" aria-hidden />
      Missed
      <span
        className="ml-1 h-2.5 w-2.5 rounded-[2px]"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      Done
    </span>
  )
}
