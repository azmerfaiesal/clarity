import type { Habit } from '../types'
import { addDays, parseDate, todayStr } from './dateUtils'

/**
 * Habit scheduling and streak maths.
 *
 * Every function is pure in the habit plus a "today" string, which is what
 * makes the awkward parts testable: leap days, months without a 31st, the rule
 * that an unfinished day does not break a streak until it is actually over, and
 * the per-week rule where the unit of a streak stops being a day at all.
 *
 * The log is `date -> amount`. Checkoff stores 1, count stores the number of
 * logs, duration stores minutes. Dates are local 'YYYY-MM-DD' throughout — an
 * 11pm entry belongs to that evening, not to tomorrow in UTC.
 */

/** Ten years of days. A guard so a corrupt createdAt cannot spin forever. */
const MAX_WALK = 3660
/** Ten years of weeks, for the per-week branch. */
const MAX_WEEKS = 530

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

/** How much was logged on a date. */
export function amountOn(habit: Habit, dateStr: string): number {
  return habit.logs[dateStr] ?? 0
}

/** The amount that finishes a day. Checkoff is always one. */
export function requiredPerDay(habit: Habit): number {
  if (habit.trackBy === 'checkoff') return 1
  return habit.dailyTarget && habit.dailyTarget > 0 ? habit.dailyTarget : 1
}

/**
 * Done means the day reached its target, not merely that it was touched —
 * three glasses out of eight is progress, and a streak counting it would lie.
 */
export function isCompletedOn(habit: Habit, dateStr: string): boolean {
  return amountOn(habit, dateStr) >= requiredPerDay(habit)
}

/** Is the habit due on this date? A per-week habit is available every day. */
export function isScheduled(habit: Habit, dateStr: string): boolean {
  const d = parseDate(dateStr)
  switch (habit.repetitionType) {
    case 'daily':
      return true
    case 'timesPerWeek':
      // No fixed days: any day can carry one of the week's completions.
      return true
    case 'weekly':
      return habit.daysOfWeek.includes(d.getDay())
    case 'monthly':
      // A habit set for the 31st simply has no occurrence in a 30-day month,
      // and the 29th none in a common-year February. Nothing to special-case:
      // that date never comes round, so it is never missed.
      return habit.datesOfMonth.includes(d.getDate())
    default:
      return false
  }
}

/**
 * The first day the maths considers. Normally the creation date, but a card
 * lets you fill in a past day, so anything backfilled earlier pulls the start
 * back — otherwise the entry would register visually and count for nothing.
 */
function startDate(habit: Habit): string {
  const created = habit.createdAt.slice(0, 10)
  const dates = Object.keys(habit.logs)
  if (dates.length === 0) return created
  const earliest = dates.reduce((a, b) => (a < b ? a : b))
  return earliest < created ? earliest : created
}

/** Scheduled dates from the habit's start through `through`, oldest first. */
export function scheduledDates(habit: Habit, through: string = todayStr()): string[] {
  const out: string[] = []
  let cursor = startDate(habit)
  for (let i = 0; i < MAX_WALK && cursor <= through; i++) {
    if (isScheduled(habit, cursor)) out.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return out
}

/** Sunday-anchored start of the week containing `dateStr`. */
export function weekStart(dateStr: string): string {
  return addDays(dateStr, -parseDate(dateStr).getDay())
}

/** Completed days inside the week containing `dateStr`. */
export function completionsInWeek(habit: Habit, dateStr: string): number {
  const from = weekStart(dateStr)
  let n = 0
  for (let i = 0; i < 7; i++) if (isCompletedOn(habit, addDays(from, i))) n++
  return n
}

export function weeklyTarget(habit: Habit): number {
  return habit.timesPerWeek && habit.timesPerWeek > 0 ? habit.timesPerWeek : 1
}

/** A per-week habit measures its streak in weeks, everything else in days. */
export function streakUnit(habit: Habit): 'week' | 'day' {
  return habit.repetitionType === 'timesPerWeek' ? 'week' : 'day'
}

/**
 * Consecutive completed units, counting back from the most recent one that is
 * genuinely past due.
 *
 * The subtlety is the same in both branches: the unit in progress has not been
 * failed yet. A day due today and untouched does not break a streak, and
 * neither does a week still short of its target with days left in it.
 */
export function currentStreak(habit: Habit, today: string = todayStr()): number {
  if (habit.repetitionType === 'timesPerWeek') {
    const target = weeklyTarget(habit)
    const firstWeek = weekStart(startDate(habit))
    let cursor = weekStart(today)
    // This week still has days left, so falling short is not yet a miss.
    if (completionsInWeek(habit, cursor) < target) cursor = addDays(cursor, -7)
    let streak = 0
    for (let i = 0; i < MAX_WEEKS && cursor >= firstWeek; i++) {
      if (completionsInWeek(habit, cursor) < target) break
      streak++
      cursor = addDays(cursor, -7)
    }
    return streak
  }

  const start = startDate(habit)
  let cursor = today
  if (isScheduled(habit, cursor) && !isCompletedOn(habit, cursor)) cursor = addDays(cursor, -1)

  let streak = 0
  for (let i = 0; i < MAX_WALK && cursor >= start; i++) {
    if (isScheduled(habit, cursor)) {
      if (!isCompletedOn(habit, cursor)) break
      streak++
    }
    cursor = addDays(cursor, -1)
  }
  return streak
}

/** Longest run of consecutive completed units ever. */
export function bestStreak(habit: Habit, today: string = todayStr()): number {
  if (habit.repetitionType === 'timesPerWeek') {
    const target = weeklyTarget(habit)
    const thisWeek = weekStart(today)
    let cursor = weekStart(startDate(habit))
    let best = 0
    let run = 0
    for (let i = 0; i < MAX_WEEKS && cursor <= thisWeek; i++) {
      if (completionsInWeek(habit, cursor) >= target) {
        run++
        if (run > best) best = run
      } else if (cursor !== thisWeek) {
        // The week in progress must not cut the run short.
        run = 0
      }
      cursor = addDays(cursor, 7)
    }
    return Math.max(best, currentStreak(habit, today))
  }

  let best = 0
  let run = 0
  for (const date of scheduledDates(habit, today)) {
    if (isCompletedOn(habit, date)) {
      run++
      if (run > best) best = run
    } else if (date !== today) {
      run = 0
    }
  }
  return Math.max(best, currentStreak(habit, today))
}

/** Distinct days completed. The card labels this "days". */
export function totalCompletions(habit: Habit): number {
  let n = 0
  for (const date of Object.keys(habit.logs)) if (isCompletedOn(habit, date)) n++
  return n
}

/** Everything logged, in the habit's own unit — logs, or minutes. */
export function totalAmount(habit: Habit): number {
  let n = 0
  for (const v of Object.values(habit.logs)) n += v
  return n
}

/** Completed / due so far, 0-1. Units still open are excluded. */
export function completionRate(habit: Habit, today: string = todayStr()): number {
  if (habit.repetitionType === 'timesPerWeek') {
    const target = weeklyTarget(habit)
    const thisWeek = weekStart(today)
    let cursor = weekStart(startDate(habit))
    let due = 0
    let met = 0
    for (let i = 0; i < MAX_WEEKS && cursor <= thisWeek; i++) {
      const hit = completionsInWeek(habit, cursor) >= target
      if (cursor !== thisWeek || hit) {
        due++
        if (hit) met++
      }
      cursor = addDays(cursor, 7)
    }
    return due === 0 ? 0 : met / due
  }

  const due = scheduledDates(habit, today).filter((d) => d !== today || isCompletedOn(habit, d))
  if (due.length === 0) return 0
  return due.filter((d) => isCompletedOn(habit, d)).length / due.length
}

/**
 * Progress within the habit's natural period: the week for daily, weekly and
 * per-week habits, the month for monthly ones. `total` counts scheduled
 * occurrences, so a Mon/Wed/Fri habit reads out of 3 rather than out of 7.
 */
export function periodProgress(
  habit: Habit,
  today: string = todayStr(),
): { done: number; total: number; label: string } {
  if (habit.repetitionType === 'timesPerWeek') {
    return {
      done: completionsInWeek(habit, today),
      total: weeklyTarget(habit),
      label: 'this week',
    }
  }

  let from: string
  let to: string
  let label: string

  if (habit.repetitionType === 'monthly') {
    const d = parseDate(today)
    const first = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    from = first
    to = `${first.slice(0, 8)}${String(lastDay).padStart(2, '0')}`
    label = 'this month'
  } else {
    from = weekStart(today)
    to = addDays(from, 6)
    label = 'this week'
  }

  const start = startDate(habit)
  let done = 0
  let total = 0
  let cursor = from < start ? start : from
  for (let i = 0; i < 40 && cursor <= to; i++) {
    if (isScheduled(habit, cursor)) {
      total++
      if (isCompletedOn(habit, cursor)) done++
    }
    cursor = addDays(cursor, 1)
  }
  return { done, total, label }
}

/**
 * 0 for untouched, then 1-4 for the heatmap ramp. With a target the ramp is
 * progress toward it; a plain checkoff is simply full.
 */
export function intensityOn(habit: Habit, dateStr: string): 0 | 1 | 2 | 3 | 4 {
  const n = amountOn(habit, dateStr)
  if (n === 0) return 0
  if (habit.trackBy === 'checkoff') return 4
  const need = requiredPerDay(habit)
  const level = need > 1 ? Math.ceil((n / need) * 4) : Math.min(n, 4)
  return Math.min(4, Math.max(1, level)) as 1 | 2 | 3 | 4
}

/** Every stat a card shows. */
export function habitStats(habit: Habit, today: string = todayStr()) {
  return {
    current: currentStreak(habit, today),
    best: bestStreak(habit, today),
    total: totalCompletions(habit),
    rate: completionRate(habit, today),
    progress: periodProgress(habit, today),
    dueToday: isScheduled(habit, today),
    doneToday: isCompletedOn(habit, today),
    amountToday: amountOn(habit, today),
    needPerDay: requiredPerDay(habit),
    unit: streakUnit(habit),
  }
}

/** "45m", "1h 30m", or a plain count. */
export function formatAmount(habit: Habit, value: number): string {
  if (habit.trackBy !== 'duration') return String(value)
  if (value < 60) return `${value}m`
  const h = Math.floor(value / 60)
  const m = value % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

/** Human summary of the repetition rule, e.g. "Weekly - Mon, Wed, Fri". */
export function repetitionLabel(habit: Habit): string {
  if (habit.repetitionType === 'daily') return 'Daily'
  if (habit.repetitionType === 'timesPerWeek') return `${weeklyTarget(habit)}× per week`
  if (habit.repetitionType === 'weekly') {
    const days = [...habit.daysOfWeek].sort((a, b) => a - b)
    if (days.length === 7) return 'Every day'
    if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))) return 'Weekdays'
    if (days.length === 2 && days.includes(0) && days.includes(6)) return 'Weekends'
    return `Weekly · ${days.map((d) => WEEKDAYS[d]).join(', ')}`
  }
  const dates = [...habit.datesOfMonth].sort((a, b) => a - b)
  return `Monthly · ${dates.map(ordinal).join(', ')}`
}

export function ordinal(n: number): string {
  const rem100 = n % 100
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`
  switch (n % 10) {
    case 1:
      return `${n}st`
    case 2:
      return `${n}nd`
    case 3:
      return `${n}rd`
    default:
      return `${n}th`
  }
}
