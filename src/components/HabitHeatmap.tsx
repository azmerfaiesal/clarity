import { useMemo } from 'react'
import type { Habit } from '../types'
import { addDays, parseDate, todayStr } from '../utils/dateUtils'
import {
  amountOn,
  formatAmount,
  intensityOn,
  isCompletedOn,
  isScheduled,
  weekdayOrder,
  weekStart,
  type WeekStart,
} from '../utils/habitUtils'
import { useWeekStart } from '../store/theme'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

type CellState = 'future' | 'untracked' | 'notdue' | 'missed' | 'done'

/** Opacity per ramp step, so one colour carries four levels of intensity. */
const RAMP = [0, 0.3, 0.5, 0.75, 1]

/**
 * How one day should read. Shared by the year grid and the month row so the
 * two views cannot drift into disagreeing about the same date.
 */
function cellFor(habit: Habit, date: string, today: string) {
  const count = amountOn(habit, date)
  const created = habit.createdAt.slice(0, 10)
  let state: CellState
  // Days before the habit existed still draw, faintly — a grid with a hole in
  // it reads as broken rather than as "not tracked yet".
  if (date > today) state = 'future'
  else if (date < created) state = 'untracked'
  // A partial day still shows colour: it was worked on, just not finished.
  else if (count > 0) state = 'done'
  else if (isScheduled(habit, date)) state = 'missed'
  else state = 'notdue'
  return { date, state, level: intensityOn(habit, date), count }
}

function cellTitle(
  habit: Habit,
  { date, state, count }: ReturnType<typeof cellFor>,
): string | undefined {
  if (state === 'future') return undefined
  const what =
    state === 'done'
      ? habit.trackBy !== 'checkoff'
        ? `${formatAmount(habit, count)}${
            habit.dailyTarget ? ` / ${formatAmount(habit, habit.dailyTarget)}` : ''
          }${isCompletedOn(habit, date) ? '' : ' (partial)'}`
        : 'done'
      : state === 'missed'
        ? 'missed'
        : state === 'untracked'
          ? 'not tracked'
          : 'not due'
  return `${date} · ${what}`
}

/** One day. Everything visual about a cell lives here and nowhere else. */
function HeatCell({
  habit,
  cell,
  size,
  radius,
  today,
  showFuture = false,
  onPickDay,
}: {
  habit: Habit
  cell: ReturnType<typeof cellFor>
  size: number
  radius: number
  today: string
  /** Draw days still to come faintly rather than not at all. */
  showFuture?: boolean
  onPickDay?: (date: string, anchor: { x: number; y: number }) => void
}) {
  const { date, state, level } = cell
  return (
    <button
      type="button"
      disabled={state === 'future'}
      onClick={(e) => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
        onPickDay?.(date, { x: r.left + r.width / 2, y: r.top })
      }}
      aria-label={`${date} — open day`}
      title={cellTitle(habit, cell)}
      style={
        {
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: `${radius}px`,
          ...(date === today ? { '--cell-glow': habit.color } : {}),
          ...(state === 'done' ? { backgroundColor: habit.color, opacity: RAMP[level] } : {}),
        } as React.CSSProperties
      }
      className={`transition-transform disabled:cursor-default enabled:cursor-pointer enabled:hover:scale-125 ${
        // Today wears a ring that breathes, so the eye finds the live end of
        // the range without reading the labels.
        date === today ? 'cell-today' : ''
      } ${
        state === 'future'
          ? showFuture
            ? 'bg-line/25'
            : 'opacity-0'
          : state === 'done'
            ? ''
            : state === 'missed'
              ? 'bg-line-strong/60'
              : state === 'untracked'
                ? 'bg-line/35'
                : 'bg-line/60'
      }`}
    />
  )
}

/**
 * A year of the habit at a glance, laid out the way contribution graphs are:
 * one column per week, oldest on the left, the first day of the week — Sunday
 * or Monday, per the setting — at the top.
 *
 * Three tones rather than the usual two. A day the habit was never due looks
 * different from one it was due and missed — without that, a Mon/Wed/Fri habit
 * would read as though it had failed four days out of every seven.
 */
export function HabitHeatmap({
  habit,
  cell = 12,
  onPickDay,
}: {
  habit: Habit
  cell?: number
  /** Clicking a cell opens that day's record, anchored to the cell. */
  onPickDay?: (date: string, anchor: { x: number; y: number }) => void
}) {
  const today = todayStr()
  const firstDay = useWeekStart()

  const { weeks, months } = useMemo(() => {
    // 53 columns ending on the week containing today.
    const start = weekStart(addDays(today, -364), firstDay)

    const weeks: ReturnType<typeof cellFor>[][] = []
    let cursor = start
    while (cursor <= today || parseDate(cursor).getDay() !== firstDay) {
      const week: ReturnType<typeof cellFor>[] = []
      for (let d = 0; d < 7; d++) {
        week.push(cellFor(habit, cursor, today))
        cursor = addDays(cursor, 1)
      }
      weeks.push(week)
      if (weeks.length > 54) break
    }

    // A week opens a month when its month differs from the week before it. That
    // flag drives both the label and the extra gap, so the two stay aligned.
    const months = weeks.map((w, i) => {
      const m = parseDate(w[0].date).getMonth()
      if (i === 0) return null
      const prev = parseDate(weeks[i - 1][0].date).getMonth()
      return m !== prev ? MONTHS[m] : null
    })

    return { weeks, months }
  }, [habit, today, firstDay])

  const gap = Math.max(2, Math.round(cell / 4))
  // Months read as separate blocks rather than one continuous ribbon.
  const monthGap = gap + 3
  // Rounded almost to a squircle, stopping short of a circle so the grid still
  // reads as a grid.
  const radius = Math.max(3, Math.round(cell / 3))
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
          {gutterLabels(firstDay).map((d, i) => (
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
          {/* Month labels. Same flex structure and gaps as the grid below, so a
              label always sits over the week that opens its month. */}
          <div className="flex" style={{ gap: `${gap}px` }}>
            {months.map((m, i) => (
              <span
                key={i}
                className="font-mono whitespace-nowrap text-faint"
                style={{
                  width: col,
                  marginLeft: m && i > 0 ? `${monthGap}px` : undefined,
                  fontSize: Math.max(8, cell - 2),
                  lineHeight: `${cell + gap + 2}px`,
                }}
              >
                {m ?? ''}
              </span>
            ))}
          </div>

          {/* One column per week, with a wider gutter where a month begins. */}
          <div className="flex" style={{ gap: `${gap}px` }}>
            {weeks.map((week, i) => (
              <div
                key={week[0].date}
                className="flex flex-col"
                style={{
                  gap: `${gap}px`,
                  marginLeft: months[i] && i > 0 ? `${monthGap}px` : undefined,
                }}
              >
                {week.map((c) => (
                  <HeatCell
                    key={c.date}
                    habit={habit}
                    cell={c}
                    size={cell}
                    radius={radius}
                    today={today}
                    onPickDay={onPickDay}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Every other row is labelled, starting one in from the top — with seven rows
 * and three labels that lands on Mon/Wed/Fri for a Sunday week and Tue/Thu/Sat
 * for a Monday one, which is the same rhythm either way.
 */
function gutterLabels(firstDay: WeekStart): string[] {
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return weekdayOrder(firstDay).map((d, i) => (i % 2 === 1 ? names[d] : ''))
}

/**
 * The current month as a single row, one box per day, numbered underneath.
 *
 * The year grid answers "how has this gone"; this answers "where am I now",
 * which is a different question and reads badly off a 53-column ribbon. Cells
 * are larger here because there are thirty of them rather than three hundred.
 */
export function HabitMonthRow({
  habit,
  cell = 16,
  onPickDay,
}: {
  habit: Habit
  cell?: number
  onPickDay?: (date: string, anchor: { x: number; y: number }) => void
}) {
  const today = todayStr()

  const days = useMemo(() => {
    const d = parseDate(today)
    const first = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
    const count = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    return Array.from({ length: count }, (_, i) => cellFor(habit, addDays(first, i), today))
  }, [habit, today])

  const gap = Math.max(2, Math.round(cell / 4))
  const radius = Math.max(3, Math.round(cell / 3))
  const label = parseDate(today).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex flex-col gap-1 pb-1">
        <div className="flex" style={{ gap: `${gap}px` }} aria-label={label}>
          {days.map((c) => (
            <HeatCell
              key={c.date}
              habit={habit}
              cell={c}
              size={cell}
              radius={radius}
              today={today}
              // The rest of the month is drawn, faintly. Dropping it would end
              // the row at today and read as a month cut short.
              showFuture
              onPickDay={onPickDay}
            />
          ))}
        </div>
        <div className="flex" style={{ gap: `${gap}px` }} aria-hidden>
          {days.map((c) => {
            const n = Number(c.date.slice(8))
            const isToday = c.date === today
            const todayN = Number(today.slice(8))
            // A number every five days, plus today — dropping any that would
            // land next to today, where two labels would collide.
            const show =
              isToday || ((n === 1 || n % 5 === 0) && Math.abs(n - todayN) > 1)
            return (
              <span
                key={c.date}
                className={`text-center font-mono ${c.date === today ? 'text-accent' : 'text-faint'}`}
                style={{ width: `${cell}px`, fontSize: Math.max(8, cell - 8), lineHeight: 1.2 }}
              >
                {show ? n : ''}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function HeatmapLegend({ habit }: { habit: Habit }) {
  // A counted habit needs a ramp legend; a binary one would be lying with it.
  if (habit.trackBy !== 'checkoff') {
    return (
      <span className="flex items-center gap-1.5 font-mono text-3xs text-faint">
        <span className="h-2.5 w-2.5 rounded-[2px] bg-line-strong/60" aria-hidden />
        None
        <span className="ml-1">Less</span>
        {[1, 2, 3, 4].map((l) => (
          <span
            key={l}
            className="h-2.5 w-2.5 rounded-[2px]"
            style={{ backgroundColor: habit.color, opacity: RAMP[l] }}
            aria-hidden
          />
        ))}
        More
        {habit.dailyTarget ? (
          <span className="ml-1">· target {formatAmount(habit, habit.dailyTarget)}</span>
        ) : null}
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1.5 font-mono text-3xs text-faint">
      <span className="h-2.5 w-2.5 rounded-[2px] bg-line/60" aria-hidden />
      Not due
      <span className="ml-1 h-2.5 w-2.5 rounded-[2px] bg-line-strong/60" aria-hidden />
      Missed
      <span
        className="ml-1 h-2.5 w-2.5 rounded-[2px]"
        style={{ backgroundColor: habit.color }}
        aria-hidden
      />
      Done
    </span>
  )
}
