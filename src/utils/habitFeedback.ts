import type { NativeFeedback } from '../native/platform'
import type { Habit } from '../types'
import { isCompletedOn } from './habitUtils'

/** The feedback for a log amount that crosses the day's completion boundary. */
export function habitCompletionFeedback(
  habit: Habit,
  date: string,
  nextAmount: number,
): Exclude<NativeFeedback, 'warning'> | null {
  const wasCompleted = isCompletedOn(habit, date)
  const nextHabit = { ...habit, logs: { ...habit.logs, [date]: nextAmount } }
  const isCompleted = isCompletedOn(nextHabit, date)

  if (!wasCompleted && isCompleted) return 'success'
  if (wasCompleted && !isCompleted) return 'selection'
  return null
}
