import { useEffect, useMemo, useRef } from 'react'
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
import { useMediaQuery } from '../utils/useMediaQuery'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

type CellState = 'future' | 'untracked' | 'notdue' | 'missed' | 'done'

/** Opacity per ramp step, so one colour carries four levels of intensity. */
const RAMP = [0, 0.3, 0.5, 0.75, 1]

/**
 * One cell size for all three ranges. A month drawn larger than the year it
 * sits beside reads as a different instrument rather than the same one zoomed
 * in, and switching between them jumps.
 */
const CELL = 12

/** Gap and corner, derived so every grid keeps the same rhythm. */
const gapFor = (cell: number) => Math.max(2, Math.round(cell / 4))
const radiusFor = (cell: number) => Math.max(3, Math.round(cell / 3))

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
  bursting = false,
  onPickDay,
}: {
  habit: Habit
  cell: ReturnType<typeof cellFor>
  size: number
  radius: number
  today: string
  /** Draw days still to come faintly rather than not at all. */
  showFuture?: boolean
  /** This day was just finished — set off the firework. */
  bursting?: boolean
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
          ...(date === today || bursting ? { '--cell-glow': habit.color } : {}),
          ...(state === 'done' ? { backgroundColor: habit.color, opacity: RAMP[level] } : {}),
        } as React.CSSProperties
      }
      className={`relative transition-transform disabled:cursor-default enabled:cursor-pointer enabled:hover:scale-125 ${
        // Today wears a ring that breathes, so the eye finds the live end of
        // the range without reading the labels.
        date === today ? 'cell-today' : ''
      } ${bursting ? 'cell-burst' : ''} ${
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
  cell = CELL,
  burstDate = null,
  onPickDay,
}: {
  habit: Habit
  cell?: number
  /** The day just finished, if any — it gets a firework. */
  burstDate?: string | null
  /** Clicking a cell opens that day's record, anchored to the cell. */
  onPickDay?: (date: string, anchor: { x: number; y: number }) => void
}) {
  const today = todayStr()
  const firstDay = useWeekStart()
  const scroller = useRef<HTMLDivElement>(null)

  // A year is wider than a phone, so it opens at the end — where today is.
  // Scrolling back through the year is a choice; scrolling forward to find
  // today should not be the price of opening the card.
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [habit.id])

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

  const gap = gapFor(cell)
  // Months read as separate blocks rather than one continuous ribbon.
  const monthGap = gap + 3
  const radius = radiusFor(cell)
  const col = `${cell}px`

  return (
    // `overflow-x-auto` clips vertically too, so the scroller needs a little
    // headroom or the firework on an edge cell is guillotined.
    <div ref={scroller} className="overflow-x-auto">
      <div className="inline-flex gap-1.5 py-1.5">
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
                    bursting={c.date === burstDate}
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
 * One month as a run of days that wraps.
 *
 * Not a calendar: seven columns at this cell size uses about a third of a
 * phone's width and pushes the card down the page for no gain. Filling the
 * row first and wrapping when it runs out puts a month in two lines. The
 * trade is weekday alignment, which the flat row never had either — today
 * still wears its ring, and any day opens on a tap.
 */
function MonthFlow({
  habit,
  year,
  month,
  today,
  cell = CELL,
  burstDate,
  onPickDay,
}: {
  habit: Habit
  year: number
  month: number
  today: string
  cell?: number
  burstDate?: string | null
  onPickDay?: (date: string, anchor: { x: number; y: number }) => void
}) {
  const days = useMemo(() => {
    const start = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const count = new Date(year, month + 1, 0).getDate()
    return Array.from({ length: count }, (_, i) => cellFor(habit, addDays(start, i), today))
  }, [habit, year, month, today])

  const gap = gapFor(cell)
  const radius = radiusFor(cell)

  return (
    <div>
      <div className="mb-1 font-mono text-3xs text-faint">{MONTHS[month]}</div>
      <div className="flex flex-wrap" style={{ gap: `${gap}px` }}>
        {days.map((c) => (
          <HeatCell
            key={c.date}
            habit={habit}
            cell={c}
            size={cell}
            radius={radius}
            today={today}
            // The rest of the month is drawn, faintly. Dropping it would end
            // the run at today and read as a month cut short.
            showFuture
            bursting={c.date === burstDate}
            onPickDay={onPickDay}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * The current month, or the three months of the current quarter, as one row of
 * days each — numbered underneath.
 *
 * The year grid answers "how has this gone"; these answer "where am I now",
 * which reads badly off a fifty-three column ribbon. Every row starts at the
 * 1st, so the columns line up by day of the month and a single number strip
 * serves all three.
 */
export function HabitMonthRows({
  habit,
  span = 'month',
  cell = CELL,
  burstDate = null,
  onPickDay,
}: {
  habit: Habit
  span?: 'month' | 'quarter'
  cell?: number
  /** The day just finished, if any — it gets a firework. */
  burstDate?: string | null
  onPickDay?: (date: string, anchor: { x: number; y: number }) => void
}) {
  const today = todayStr()
  // Below this the flat row is wider than the screen, which is the whole
  // problem: today ends up off the right-hand edge of a view meant to show it.
  const narrow = useMediaQuery('(max-width: 639px)')

  const months = useMemo(() => {
    const d = parseDate(today)
    const first = span === 'quarter' ? Math.floor(d.getMonth() / 3) * 3 : d.getMonth()
    const count = span === 'quarter' ? 3 : 1
    return Array.from({ length: count }, (_, i) => ({ year: d.getFullYear(), month: first + i }))
  }, [today, span])

  const rows = useMemo(() => {
    const d = parseDate(today)
    const year = d.getFullYear()
    // The quarter is the three-month block containing today, so the current
    // month is always the first, middle or last row rather than a moving one.
    const first = span === 'quarter' ? Math.floor(d.getMonth() / 3) * 3 : d.getMonth()
    const count = span === 'quarter' ? 3 : 1
    return Array.from({ length: count }, (_, i) => {
      const m = first + i
      const start = `${year}-${String(m + 1).padStart(2, '0')}-01`
      const days = new Date(year, m + 1, 0).getDate()
      return {
        label: MONTHS[m],
        current: m === d.getMonth(),
        days: Array.from({ length: days }, (_, k) => cellFor(habit, addDays(start, k), today)),
      }
    })
  }, [habit, today, span])

  if (narrow) {
    return (
      <div className="space-y-3">
        {months.map((m) => (
          <MonthFlow
            key={`${m.year}-${m.month}`}
            habit={habit}
            year={m.year}
            month={m.month}
            today={today}
            cell={cell}
            burstDate={burstDate}
            onPickDay={onPickDay}
          />
        ))}
      </div>
    )
  }

  const gap = gapFor(cell)
  const radius = radiusFor(cell)
  const longest = Math.max(...rows.map((r) => r.days.length))
  const todayN = Number(today.slice(8))
  const todayInView = rows.some((r) => r.current)

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex flex-col gap-1 py-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center" style={{ gap: `${gap}px` }}>
            <span
              className={`w-7 shrink-0 pr-1 text-right font-mono ${
                row.current ? 'text-muted' : 'text-faint'
              }`}
              style={{ fontSize: Math.max(8, cell - 7), lineHeight: 1 }}
            >
              {row.label}
            </span>
            {row.days.map((c) => (
              <HeatCell
                key={c.date}
                habit={habit}
                cell={c}
                size={cell}
                radius={radius}
                today={today}
                // The rest of the month is drawn, faintly. Dropping it would
                // end the row at today and read as a month cut short.
                showFuture
                bursting={c.date === burstDate}
                onPickDay={onPickDay}
              />
            ))}
          </div>
        ))}

        <div className="flex" style={{ gap: `${gap}px` }} aria-hidden>
          <span className="w-7 shrink-0" />
          {Array.from({ length: longest }, (_, i) => {
            const n = i + 1
            const isToday = todayInView && n === todayN
            // A number every five days, plus today — dropping any that would
            // land next to today, where two labels would collide.
            const show =
              isToday ||
              ((n === 1 || n % 5 === 0) && (!todayInView || Math.abs(n - todayN) > 1))
            return (
              <span
                key={n}
                className={`text-center font-mono ${isToday ? 'text-accent' : 'text-faint'}`}
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
