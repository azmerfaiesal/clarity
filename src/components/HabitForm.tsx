import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Habit, RepetitionType } from '../types'
import type { HabitDraft } from '../store/habitStore'
import { WEEKDAYS, ordinal } from '../utils/habitUtils'

// A fuller ramp than the list palette — habits sit side by side and need to be
// told apart at a glance.
const HABIT_COLORS = [
  '#3bff9e', '#5eead4', '#a3e635', '#ffd23d', '#ffb020', '#ff8a3d',
  '#ff4d5e', '#ff5cd6', '#c084fc', '#a78bfa', '#7c8cff', '#4aa8ff', '#3ddbf0',
]
const ICONS = ['📚', '🏃', '🧘', '💧', '💪', '🎧', '✍️', '🌱', '🛏️', '🥗', '🧹', '💰']

const NAME_MAX = 50
const DESC_MAX = 200

/**
 * Create/edit habit dialog. Editing reuses the same form pre-populated; the
 * only field it will not touch is the creation date, which the streak maths
 * walks back to.
 */
export function HabitForm({
  habit,
  onSave,
  onClose,
}: {
  /** Present when editing; absent when creating. */
  habit?: Habit
  onSave: (draft: HabitDraft) => void
  onClose: () => void
}) {
  const [name, setName] = useState(habit?.name ?? '')
  const [description, setDescription] = useState(habit?.description ?? '')
  const [repetitionType, setRepetitionType] = useState<RepetitionType>(
    habit?.repetitionType ?? 'daily',
  )
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(habit?.daysOfWeek ?? [1, 3, 5])
  // Weekdays and weekends are presets over the weekly rule, not separate models,
  // so the schedule stays one concept for the streak maths.
  const sameDays = (a: number[], b: number[]) =>
    a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i])
  const preset: string =
    repetitionType === 'daily'
      ? 'daily'
      : repetitionType === 'monthly'
        ? 'monthly'
        : sameDays(daysOfWeek, [1, 2, 3, 4, 5])
          ? 'weekdays'
          : sameDays(daysOfWeek, [0, 6])
            ? 'weekends'
            : 'pick'
  const applyPreset = (p: string) => {
    if (p === 'daily') return setRepetitionType('daily')
    if (p === 'monthly') return setRepetitionType('monthly')
    setRepetitionType('weekly')
    if (p === 'weekdays') setDaysOfWeek([1, 2, 3, 4, 5])
    else if (p === 'weekends') setDaysOfWeek([0, 6])
    else if (daysOfWeek.length === 0) setDaysOfWeek([1, 3, 5])
  }
  const [datesOfMonth, setDatesOfMonth] = useState<number[]>(habit?.datesOfMonth ?? [1])
  const [color, setColor] = useState(habit?.color ?? HABIT_COLORS[0])
  const [icon, setIcon] = useState(habit?.icon ?? '')
  const [targetStreak, setTargetStreak] = useState(
    habit?.targetStreak ? String(habit.targetStreak) : '',
  )
  const [allowRepeats, setAllowRepeats] = useState(habit?.allowRepeats ?? false)
  const [dailyTarget, setDailyTarget] = useState(
    habit?.dailyTarget ? String(habit.dailyTarget) : '',
  )
  const [showErrors, setShowErrors] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const nameError = !name.trim() ? 'Give the habit a name.' : null
  const scheduleError =
    repetitionType === 'weekly' && daysOfWeek.length === 0
      ? 'Pick at least one day.'
      : repetitionType === 'monthly' && datesOfMonth.length === 0
        ? 'Pick at least one date.'
        : null

  const submit = () => {
    if (nameError || scheduleError) {
      setShowErrors(true)
      return
    }
    const parsedTarget = Number.parseInt(targetStreak, 10)
    const parsedDaily = Number.parseInt(dailyTarget, 10)
    onSave({
      name: name.trim().slice(0, NAME_MAX),
      description: description.trim().slice(0, DESC_MAX),
      repetitionType,
      daysOfWeek: repetitionType === 'weekly' ? [...daysOfWeek].sort((a, b) => a - b) : [],
      datesOfMonth: repetitionType === 'monthly' ? [...datesOfMonth].sort((a, b) => a - b) : [],
      color,
      icon,
      targetStreak: Number.isFinite(parsedTarget) && parsedTarget > 0 ? parsedTarget : null,
      allowRepeats,
      // Only meaningful alongside repeats; dropped otherwise so a leftover value
      // cannot make a plain habit impossible to complete.
      dailyTarget: allowRepeats && parsedDaily > 0 ? parsedDaily : null,
    })
  }

  const toggle = (list: number[], set: (v: number[]) => void, value: number) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value])

  return (
    <div
      className="anim-fade-in fixed inset-0 z-50 flex items-end justify-center bg-[var(--scrim)] backdrop-blur-[3px] sm:items-center sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={habit ? 'Edit habit' : 'New habit'}
        onClick={(e) => e.stopPropagation()}
        className="anim-scale-in max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-xl border border-line bg-raised shadow-2xl shadow-black/20 sm:rounded-xl dark:shadow-black/70"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <span className="text-sm font-medium text-muted">{habit ? 'Edit habit' : 'New habit'}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1.5 cursor-pointer rounded-md p-1.5 text-faint transition-colors hover:bg-surface hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 px-5 py-4">
          {/* Name */}
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-faint">Habit name</span>
            <input
              autoFocus
              value={name}
              maxLength={NAME_MAX}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit()
              }}
              placeholder="e.g. Read 30 minutes, Meditate, Exercise"
              className="w-full rounded-md border border-line bg-surface px-3 py-2 text-base text-ink outline-none placeholder:text-faint focus:border-accent"
            />
            <span className="mt-1 flex items-center justify-between text-3xs">
              <span className="text-danger">{showErrors && nameError ? nameError : ''}</span>
              <span className="font-mono text-faint">
                {name.length}/{NAME_MAX}
              </span>
            </span>
          </label>

          {/* Description */}
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-faint">Description</span>
            <textarea
              value={description}
              maxLength={DESC_MAX}
              rows={2}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Why is this habit important to you?"
              className="w-full resize-none rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-faint focus:border-accent"
            />
            <span className="mt-1 block text-right font-mono text-3xs text-faint">
              {description.length}/{DESC_MAX}
            </span>
          </label>

          {/* Repetition */}
          <div>
            <span className="mb-1.5 block text-xs font-medium text-faint">Repeats</span>
            <div role="radiogroup" aria-label="Repetition" className="flex flex-wrap gap-1.5">
              {[
                ['daily', 'Daily'],
                ['weekdays', 'Weekdays'],
                ['weekends', 'Weekends'],
                ['pick', 'Pick days'],
                ['monthly', 'Monthly'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={preset === value}
                  onClick={() => applyPreset(value)}
                  className={`cursor-pointer rounded-md border px-3 py-1.5 text-xs transition-colors ${
                    preset === value
                      ? 'border-accent/50 bg-accent-soft font-medium text-ink'
                      : 'border-line text-muted hover:bg-surface hover:text-ink'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {repetitionType === 'weekly' && (
              <div className="mt-2.5 flex flex-wrap gap-1.5" role="group" aria-label="Days of week">
                {WEEKDAYS.map((d, i) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={daysOfWeek.includes(i)}
                    onClick={() => toggle(daysOfWeek, setDaysOfWeek, i)}
                    className={`w-11 cursor-pointer rounded-md border px-1 py-1.5 text-3xs font-medium transition-colors ${
                      daysOfWeek.includes(i)
                        ? 'border-accent/50 bg-accent-soft text-accent'
                        : 'border-line text-muted hover:text-ink'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}

            {repetitionType === 'monthly' && (
              <div
                className="mt-2.5 grid grid-cols-[repeat(auto-fill,minmax(2rem,1fr))] gap-1"
                role="group"
                aria-label="Dates of month"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={datesOfMonth.includes(d)}
                    aria-label={ordinal(d)}
                    onClick={() => toggle(datesOfMonth, setDatesOfMonth, d)}
                    className={`cursor-pointer rounded border py-1 font-mono text-3xs transition-colors ${
                      datesOfMonth.includes(d)
                        ? 'border-accent/50 bg-accent-soft text-accent'
                        : 'border-line text-muted hover:text-ink'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}

            {repetitionType === 'monthly' && datesOfMonth.some((d) => d > 28) && (
              <p className="mt-2 text-3xs text-faint">
                Dates after the 28th are skipped in months that are too short — February keeps the
                29th only in a leap year.
              </p>
            )}

            {showErrors && scheduleError && (
              <p className="mt-1.5 text-3xs text-danger">{scheduleError}</p>
            )}
          </div>

          {/* Colour + icon */}
          <div className="flex flex-wrap gap-x-8 gap-y-4">
            <div>
              <span className="mb-1.5 block text-xs font-medium text-faint">Colour</span>
              <div className="flex gap-1.5" role="radiogroup" aria-label="Habit color">
                {HABIT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={color === c}
                    aria-label={`Color ${c}`}
                    onClick={() => setColor(c)}
                    className={`h-4 w-4 cursor-pointer rounded-full transition-transform ${
                      color === c
                        ? 'ring-2 ring-accent ring-offset-2 ring-offset-raised'
                        : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div className="min-w-0">
              <span className="mb-1.5 block text-xs font-medium text-faint">Icon</span>
              <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Habit icon">
                <button
                  type="button"
                  role="radio"
                  aria-checked={icon === ''}
                  aria-label="No icon"
                  onClick={() => setIcon('')}
                  className={`h-6 w-6 cursor-pointer rounded border text-3xs transition-colors ${
                    icon === '' ? 'border-accent/50 bg-accent-soft text-accent' : 'border-line text-faint'
                  }`}
                >
                  –
                </button>
                {ICONS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    role="radio"
                    aria-checked={icon === e}
                    aria-label={`Icon ${e}`}
                    onClick={() => setIcon(e)}
                    className={`h-6 w-6 cursor-pointer rounded border text-xs transition-colors ${
                      icon === e ? 'border-accent/50 bg-accent-soft' : 'border-line hover:bg-surface'
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Counting */}
          <div>
            <span className="mb-1.5 block text-xs font-medium text-faint">Counting</span>
            <button
              type="button"
              role="switch"
              aria-checked={allowRepeats}
              onClick={() => setAllowRepeats((v) => !v)}
              className={`cursor-pointer rounded-md border px-3 py-1.5 text-xs transition-colors ${
                allowRepeats
                  ? 'border-accent/50 bg-accent-soft font-medium text-ink'
                  : 'border-line text-muted hover:bg-surface hover:text-ink'
              }`}
            >
              Allow several per day
            </button>
            {allowRepeats && (
              <label className="mt-2.5 flex items-center gap-2">
                <span className="text-xs text-faint">Per day target</span>
                <input
                  type="number"
                  min={1}
                  value={dailyTarget}
                  onChange={(e) => setDailyTarget(e.target.value)}
                  placeholder="8"
                  aria-label="Per day target"
                  className="w-20 rounded-md border border-line bg-surface px-2.5 py-1.5 font-mono text-sm text-ink outline-none placeholder:text-faint focus:border-accent"
                />
                <span className="text-3xs text-faint">
                  {dailyTarget
                    ? `the day counts as done at ${dailyTarget}`
                    : 'blank means one log finishes the day'}
                </span>
              </label>
            )}
          </div>

          {/* Target streak */}
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-faint">
              Target streak <span className="text-faint">(optional)</span>
            </span>
            <input
              type="number"
              min={1}
              value={targetStreak}
              onChange={(e) => setTargetStreak(e.target.value)}
              placeholder="30"
              className="w-28 rounded-md border border-line bg-surface px-3 py-2 font-mono text-sm text-ink outline-none placeholder:text-faint focus:border-accent"
            />
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-md px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            className="cursor-pointer rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-all hover:bg-accent-hi hover:glow-sm"
          >
            {habit ? 'Save changes' : 'Create habit'}
          </button>
        </div>
      </div>
    </div>
  )
}
