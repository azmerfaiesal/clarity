import { ChevronDown, Repeat2 } from 'lucide-react'
import { useState } from 'react'
import type { TaskRecurrence, Weekday } from '../types'
import { formatTaskRecurrence } from '../utils/taskRecurrence'

const FREQUENCIES: Array<{ value: TaskRecurrence['frequency'] | 'never'; label: string }> = [
  { value: 'never', label: 'Never' },
  { value: 'daily', label: 'Daily' },
  { value: 'selectedDays', label: 'Selected days' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

const WEEKDAYS: Array<{ value: Weekday; short: string; label: string }> = [
  { value: 1, short: 'M', label: 'Monday' },
  { value: 2, short: 'Tu', label: 'Tuesday' },
  { value: 3, short: 'W', label: 'Wednesday' },
  { value: 4, short: 'Th', label: 'Thursday' },
  { value: 5, short: 'F', label: 'Friday' },
  { value: 6, short: 'Sa', label: 'Saturday' },
  { value: 0, short: 'Su', label: 'Sunday' },
]

export type TaskRecurrenceFieldProps = {
  value: TaskRecurrence | null
  anchor: Date | null
  onChange: (value: TaskRecurrence | null) => void
}

export function TaskRecurrenceField({ value, anchor, onChange }: TaskRecurrenceFieldProps) {
  const [open, setOpen] = useState(false)
  const [weekdayError, setWeekdayError] = useState(false)
  const summary = value && anchor ? formatTaskRecurrence(value, anchor) : 'Never'

  const chooseFrequency = (frequency: TaskRecurrence['frequency'] | 'never') => {
    if (!anchor) return
    setWeekdayError(false)
    if (frequency === 'never') onChange(null)
    else if (frequency === 'daily') onChange({ frequency: 'daily' })
    else if (frequency === 'weekly') onChange({ frequency: 'weekly' })
    else if (frequency === 'monthly') {
      onChange({ frequency: 'monthly', preferredDay: anchor.getDate() })
    } else {
      onChange({ frequency: 'selectedDays', weekdays: [anchor.getDay() as Weekday] })
    }
  }

  const toggleWeekday = (weekday: Weekday) => {
    if (value?.frequency !== 'selectedDays') return
    const selected = value.weekdays.includes(weekday)
    if (selected && value.weekdays.length === 1) {
      setWeekdayError(true)
      return
    }
    setWeekdayError(false)
    const weekdays = selected
      ? value.weekdays.filter((item) => item !== weekday)
      : [...value.weekdays, weekday]
    onChange({ frequency: 'selectedDays', weekdays: weekdays.sort((a, b) => a - b) })
  }

  return (
    <div
      data-testid="task-repeat-field"
      className="min-w-0"
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !open) return
        event.preventDefault()
        event.stopPropagation()
        setOpen(false)
      }}
    >
      <button
        type="button"
        aria-label={`Repeat: ${summary}`}
        aria-expanded={open}
        disabled={!anchor}
        onClick={() => {
          if (!anchor) return
          setOpen((current) => !current)
        }}
        className="motion-interactive flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-md border border-line px-3 py-2 text-left text-sm text-muted outline-none transition-colors hover:border-accent/50 hover:bg-accent-soft hover:text-ink focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-45"
      >
        <Repeat2 className="h-4 w-4 shrink-0 text-accent" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{summary}</span>
        <ChevronDown
          className={`motion-disclosure-chevron h-4 w-4 shrink-0 ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {!anchor && <p className="mt-1 text-xs text-faint">Add a due date or reminder first.</p>}

      <div
        data-testid="task-repeat-panel"
        data-open={open}
        className="motion-repeat-panel"
        inert={!open}
        aria-hidden={!open}
      >
        <div>
          <div className="mt-2 rounded-lg border border-line bg-surface p-2.5 shadow-lg shadow-black/5 dark:shadow-black/35">
            <div
              role="radiogroup"
              aria-label="Repeat frequency"
              className="grid grid-cols-2 gap-1.5 sm:grid-cols-5"
            >
              {FREQUENCIES.map((option) => {
                const selected = option.value === (value?.frequency ?? 'never')
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => chooseFrequency(option.value)}
                    className={`motion-interactive min-h-11 cursor-pointer rounded-md border px-2 py-2 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/30 ${
                      selected
                        ? 'border-accent/50 bg-accent-soft text-accent glow-sm'
                        : 'border-line text-muted hover:border-accent/30 hover:bg-raised hover:text-ink'
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>

            {value?.frequency === 'selectedDays' && (
              <div className="mt-2.5 border-t border-line pt-2.5">
                <div className="grid grid-cols-7 gap-1" role="group" aria-label="Repeat days">
                  {WEEKDAYS.map((weekday) => {
                    const selected = value.weekdays.includes(weekday.value)
                    return (
                      <button
                        key={weekday.value}
                        type="button"
                        role="checkbox"
                        aria-label={weekday.label}
                        aria-checked={selected}
                        onClick={() => toggleWeekday(weekday.value)}
                        className={`motion-interactive min-h-11 min-w-0 cursor-pointer rounded-md border px-0.5 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/30 ${
                          selected
                            ? 'border-accent bg-accent text-accent-ink glow-sm'
                            : 'border-line bg-raised text-muted hover:border-accent/40 hover:text-ink'
                        }`}
                      >
                        {weekday.short}
                      </button>
                    )
                  })}
                </div>
                {weekdayError && (
                  <p role="alert" className="mt-1.5 text-xs text-danger">
                    Choose at least one day.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
