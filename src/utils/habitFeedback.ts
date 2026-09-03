import type { NativeFeedback } from '../native/platform'
import type { Habit } from '../types'
import { isCompletedOn } from './habitUtils'

type CompletionFeedback = Exclude<NativeFeedback, 'warning'>

function habitCompletionFeedback(
  habit: Habit,
  date: string,
  nextAmount: number,
): CompletionFeedback | null {
  const wasCompleted = isCompletedOn(habit, date)
  const nextHabit = { ...habit, logs: { ...habit.logs, [date]: nextAmount } }
  const isCompleted = isCompletedOn(nextHabit, date)

  if (!wasCompleted && isCompleted) return 'success'
  if (wasCompleted && !isCompleted) return 'selection'
  return null
}

/**
 * Commit one amount change in the same order across all habit controls.
 * Feedback is presentation-only and fires before the supplied state mutation.
 */
export function commitHabitAmount({
  habit,
  date,
  operation,
  value,
  feedback,
  mutate,
}: {
  habit: Habit
  date: string
  operation: 'adjust' | 'set'
  value: number
  feedback: (kind: CompletionFeedback) => void
  mutate: (amount: number) => void
}): { amount: number; feedback: CompletionFeedback | null } {
  const currentAmount = habit.logs[date] ?? 0
  const amount =
    operation === 'adjust' ? Math.max(0, currentAmount + value) : Math.max(0, Math.round(value))
  const selectedFeedback = habitCompletionFeedback(habit, date, amount)

  if (selectedFeedback) feedback(selectedFeedback)
  mutate(amount)

  return { amount, feedback: selectedFeedback }
}
