import type { Habit } from '../types'
import { addDays, parseDate, todayStr } from './dateUtils'

/**
 * Habit scheduling and streak maths.
 *
 * Everything here is a pure function of the habit plus a "today" string, which
 * is what makes the awkward parts testable: leap days, months without a 31st,
 * and the rule that an unfinished habit does not break a streak until its day
 * is actually over.
 *
 * Dates are local 'YYYY-MM-DD' strings throughout — never ISO instants. A
 * habit completed at 11pm belongs to that evening, not to tomorrow in UTC.
 */

/** Ten years of days. A guard so a corrupt createdAt cannot spin forever. */
const MAX_WALK = 3660

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

/** Is this habit due on this date? */
export function isScheduled(habit: Habit, dateStr: string): boolean {
  const d = parseDate(dateStr)
  switch (habit.repetitionType) {
    case 'daily':
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
 * The first day the maths considers. Normally the creation date, but a habit
 * card lets you tick a past scheduled day, so anything backfilled earlier than
 * that pulls the start back — otherwise the tick would register visually while
 * counting for nothing.
 */
function startDate(habit: Habit): string {
  const created = habit.createdAt.slice(0, 10)
  if (habit.completedDates.length === 0) return created
  const earliest = habit.completedDates.reduce((a, b) => (a < b ? a : b))
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

export function isCompletedOn(habit: Habit, dateStr: string): boolean {
  return habit.completedDates.includes(dateStr)
}

/**
 * Consecutive scheduled occurrences completed, counting back from the most
 * recent one that is genuinely past due.
 *
 * The subtlety: if the habit is due today and not yet ticked, the streak is
 * intact — the day is not over. So today is skipped rather than treated as a
 * miss. Tomorrow, that same untouched day does break it.
 */
export function currentStreak(habit: Habit, today: string = todayStr()): number {
  const done = new Set(habit.completedDates)
  const start = startDate(habit)
  let cursor = today

  if (isScheduled(habit, cursor) && !done.has(cursor)) cursor = addDays(cursor, -1)

  let streak = 0
  for (let i = 0; i < MAX_WALK && cursor >= start; i++) {
    if (isScheduled(habit, cursor)) {
      if (!done.has(cursor)) break
      streak++
    }
    cursor = addDays(cursor, -1)
  }
  return streak
}

/** Longest run of consecutive scheduled occurrences ever completed. */
export function bestStreak(habit: Habit, today: string = todayStr()): number {
  const done = new Set(habit.completedDates)
  let best = 0
  let run = 0
  for (const date of scheduledDates(habit, today)) {
    if (done.has(date)) {
      run++
      if (run > best) best = run
    } else if (date !== today) {
      // Today still being open must not cut the run short.
      run = 0
    }
  }
  return Math.max(best, currentStreak(habit, today))
}

/** Completions that fall on a scheduled day, from the habit's start onward. */
export function totalCompletions(habit: Habit): number {
  return habit.completedDates.length
}

/** Completed ÷ scheduled so far, 0–1. Days still open are excluded. */
export function completionRate(habit: Habit, today: string = todayStr()): number {
  const done = new Set(habit.completedDates)
  const due = scheduledDates(habit, today).filter((d) => d !== today || done.has(d))
  if (due.length === 0) return 0
  return due.filter((d) => done.has(d)).length / due.length
}

/** Sunday-anchored start of the week containing `dateStr`. */
export function weekStart(dateStr: string): string {
  return addDays(dateStr, -parseDate(dateStr).getDay())
}

/**
 * Progress within the habit's natural period: this week for daily and weekly
 * habits, this month for monthly ones. `total` counts scheduled occurrences,
 * so a Mon/Wed/Fri habit reads out of 3 rather than out of 7.
 */
export function periodProgress(
  habit: Habit,
  today: string = todayStr(),
): { done: number; total: number; label: string } {
  const completed = new Set(habit.completedDates)
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
      if (completed.has(cursor)) done++
    }
    cursor = addDays(cursor, 1)
  }
  return { done, total, label }
}

/** Every stat the card shows, computed in one pass over the same log. */
export function habitStats(habit: Habit, today: string = todayStr()) {
  return {
    current: currentStreak(habit, today),
    best: bestStreak(habit, today),
    total: totalCompletions(habit),
    rate: completionRate(habit, today),
    progress: periodProgress(habit, today),
    dueToday: isScheduled(habit, today),
    doneToday: isCompletedOn(habit, today),
  }
}

/** Human summary of the repetition rule, e.g. "Weekly · Mon, Wed, Fri". */
export function repetitionLabel(habit: Habit): string {
  if (habit.repetitionType === 'daily') return 'Daily'
  if (habit.repetitionType === 'weekly') {
    const days = [...habit.daysOfWeek].sort((a, b) => a - b).map((d) => WEEKDAYS[d])
    return days.length === 7 ? 'Every day' : `Weekly · ${days.join(', ')}`
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
