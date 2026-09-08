import type { Task, TaskRecurrence, Weekday } from '../types'
import { parseDate, toDateStr } from './dateUtils'

const WEEKDAY_NAMES = Array.from({ length: 7 }, (_, weekday) =>
  new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(new Date(2026, 7, 2 + weekday)),
)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function normalizeTaskRecurrence(value: unknown): TaskRecurrence | null {
  if (!isRecord(value)) return null

  if (value.frequency === 'daily') return { frequency: 'daily' }
  if (value.frequency === 'weekly') return { frequency: 'weekly' }

  if (value.frequency === 'selectedDays') {
    if (!Array.isArray(value.weekdays) || value.weekdays.length === 0) return null
    if (
      value.weekdays.some(
        (weekday) => !Number.isInteger(weekday) || Number(weekday) < 0 || Number(weekday) > 6,
      )
    ) {
      return null
    }
    const weekdays = [...new Set(value.weekdays as Weekday[])].sort((a, b) => a - b)
    return weekdays.length > 0 ? { frequency: 'selectedDays', weekdays } : null
  }

  if (value.frequency === 'monthly') {
    if (
      !Number.isInteger(value.preferredDay) ||
      Number(value.preferredDay) < 1 ||
      Number(value.preferredDay) > 31
    ) {
      return null
    }
    return { frequency: 'monthly', preferredDay: Number(value.preferredDay) }
  }

  return null
}

function joinWeekdays(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
}

export function formatTaskRecurrence(recurrence: TaskRecurrence, anchor: Date): string {
  switch (recurrence.frequency) {
    case 'daily':
      return 'Every day'
    case 'selectedDays':
      return `Every ${joinWeekdays(recurrence.weekdays.map((weekday) => WEEKDAY_NAMES[weekday]))}`
    case 'weekly':
      return `Every ${WEEKDAY_NAMES[anchor.getDay()]}`
    case 'monthly':
      return `Monthly on day ${recurrence.preferredDay}`
  }
}

export function taskRecurrenceAnchor(
  task: Pick<Task, 'reminder' | 'dueDate'>,
): Date | null {
  if (task.reminder) {
    const reminder = new Date(task.reminder)
    if (!Number.isNaN(reminder.getTime())) return reminder
  }

  if (!task.dueDate) return null
  const dueDate = parseDate(task.dueDate)
  return Number.isNaN(dueDate.getTime()) || toDateStr(dueDate) !== task.dueDate ? null : dueDate
}
