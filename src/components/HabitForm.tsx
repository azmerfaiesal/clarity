import { BookmarkPlus, Lightbulb, Pencil, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Habit, HabitTemplate, RepetitionType, TrackBy } from '../types'
import type { HabitDraft } from '../store/habitStore'
import { WEEKDAYS, ordinal } from '../utils/habitUtils'
import { HabitIcon } from './HabitIcon'
import { IconPicker } from './IconPicker'

/** Pastels first, then the saturated ramp — soft enough to sit side by side. */
const HABIT_COLORS = [
  '#a7f3d0', '#bbf7d0', '#d9f99d', '#fde68a', '#fed7aa', '#fecaca',
  '#fbcfe8', '#e9d5ff', '#c7d2fe', '#bfdbfe', '#a5f3fc', '#99f6e4',
  '#3bff9e', '#a3e635', '#ffd23d', '#ffb020', '#ff8a3d', '#ff4d5e',
  '#ff5cd6', '#c084fc', '#a78bfa', '#7c8cff', '#4aa8ff', '#3ddbf0',
]

const NAME_MAX = 50
const DESC_MAX = 200
const DURATION_PRESETS = [15, 25, 45, 60, 90]

type Preset = 'daily' | 'weekdays' | 'weekends' | 'pick' | 'perweek' | 'monthly'

/**
 * Create/edit habit dialog. Editing reuses the same form pre-populated; the one
 * field it will not touch is the creation date, which the streak maths walks
 * back to.
 */
export function HabitForm({
  habit,
  seed,
  templateMode = false,
  templates,
  onSave,
  onSaveTemplate,
  onDeleteTemplate,
  onClose,
}: {
  habit?: Habit
  /** Values to start from when this is not an edit — a template being used. */
  seed?: HabitTemplate
  /** Editing the template itself rather than a habit built from one. */
  templateMode?: boolean
  templates: HabitTemplate[]
  onSave: (draft: HabitDraft) => void
  onSaveTemplate: (draft: HabitDraft) => void
  onDeleteTemplate: (id: string) => void
  onClose: () => void
}) {
  // Everything below reads from one source: the habit being edited, or the
  // template being used or edited, or nothing at all.
  const from = habit ?? seed
  const [name, setName] = useState(from?.name ?? '')
  const [description, setDescription] = useState(from?.description ?? '')
  const [repetitionType, setRepetitionType] = useState<RepetitionType>(
    from?.repetitionType ?? 'daily',
  )
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(
    from?.daysOfWeek?.length ? from.daysOfWeek : [1, 3, 5],
  )
  const [datesOfMonth, setDatesOfMonth] = useState<number[]>(
    from?.datesOfMonth?.length ? from.datesOfMonth : [1],
  )
  const [timesPerWeek, setTimesPerWeek] = useState(from?.timesPerWeek ?? 3)
  const [trackBy, setTrackBy] = useState<TrackBy>(from?.trackBy ?? 'checkoff')
  const [dailyTarget, setDailyTarget] = useState(from?.dailyTarget ? String(from.dailyTarget) : '')
  const [color, setColor] = useState(from?.color ?? HABIT_COLORS[0])
  const [icon, setIcon] = useState(from?.icon ?? '')
  const [targetStreak, setTargetStreak] = useState(
    habit?.targetStreak ? String(habit.targetStreak) : '',
  )
  const [reminderTime, setReminderTime] = useState(habit?.reminderTime ?? '')
  const [showErrors, setShowErrors] = useState(false)
  const [pickingIcon, setPickingIcon] = useState(false)
  const [browsing, setBrowsing] = useState(false)
  const [savedTemplate, setSavedTemplate] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !pickingIcon) {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose, pickingIcon])

  const sameDays = (a: number[], b: number[]) =>
    a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i])

  const preset: Preset =
    repetitionType === 'daily'
      ? 'daily'
      : repetitionType === 'monthly'
        ? 'monthly'
        : repetitionType === 'timesPerWeek'
          ? 'perweek'
          : sameDays(daysOfWeek, [1, 2, 3, 4, 5])
            ? 'weekdays'
            : sameDays(daysOfWeek, [0, 6])
              ? 'weekends'
              : 'pick'

  const applyPreset = (p: Preset) => {
    if (p === 'daily') return setRepetitionType('daily')
    if (p === 'monthly') return setRepetitionType('monthly')
    if (p === 'perweek') return setRepetitionType('timesPerWeek')
    setRepetitionType('weekly')
    if (p === 'weekdays') setDaysOfWeek([1, 2, 3, 4, 5])
    else if (p === 'weekends') setDaysOfWeek([0, 6])
    else if (daysOfWeek.length === 0) setDaysOfWeek([1, 3, 5])
  }

  const nameError = !name.trim() ? 'Give the habit a name.' : null
  const scheduleError =
    repetitionType === 'weekly' && daysOfWeek.length === 0
      ? 'Pick at least one day.'
      : repetitionType === 'monthly' && datesOfMonth.length === 0
        ? 'Pick at least one date.'
        : null

  const buildDraft = (): HabitDraft => {
    const parsedTarget = Number.parseInt(targetStreak, 10)
    const parsedDaily = Number.parseInt(dailyTarget, 10)
    return {
      name: name.trim().slice(0, NAME_MAX),
      description: description.trim().slice(0, DESC_MAX),
      repetitionType,
      daysOfWeek: repetitionType === 'weekly' ? [...daysOfWeek].sort((a, b) => a - b) : [],
      datesOfMonth: repetitionType === 'monthly' ? [...datesOfMonth].sort((a, b) => a - b) : [],
      timesPerWeek: repetitionType === 'timesPerWeek' ? Math.max(1, timesPerWeek) : null,
      trackBy,
      // Only meaningful with a target mode; dropped otherwise so a leftover
      // value cannot make a plain checkoff impossible to complete.
      dailyTarget: trackBy === 'checkoff' || !(parsedDaily > 0) ? null : parsedDaily,
      color,
      icon,
      targetStreak: Number.isFinite(parsedTarget) && parsedTarget > 0 ? parsedTarget : null,
      reminderTime: reminderTime || null,
      source: habit?.source ?? 'manual',
    }
  }

  const submit = () => {
    if (nameError || scheduleError) {
      setShowErrors(true)
      return
    }
    onSave(buildDraft())
  }

  const applyTemplate = (t: HabitTemplate) => {
    setName(t.name)
    setDescription(t.description)
    setRepetitionType(t.repetitionType)
    setDaysOfWeek(t.daysOfWeek.length ? t.daysOfWeek : [1, 3, 5])
    setDatesOfMonth(t.datesOfMonth.length ? t.datesOfMonth : [1])
    setTimesPerWeek(t.timesPerWeek ?? 3)
    setTrackBy(t.trackBy)
    setDailyTarget(t.dailyTarget ? String(t.dailyTarget) : '')
    setColor(t.color)
    setIcon(t.icon)
    setBrowsing(false)
  }

  const toggle = (list: number[], set: (v: number[]) => void, value: number) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value])

  const targetLabel = trackBy === 'duration' ? 'minutes' : 'times'
  const title = templateMode ? 'Edit template' : habit ? 'Edit habit' : 'New habit'

  return (
    <div
      className="anim-fade-in fixed inset-0 z-50 flex items-end justify-center bg-[var(--scrim)] backdrop-blur-[3px] sm:items-center sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="anim-scale-in max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-xl border border-line bg-raised shadow-2xl shadow-black/20 sm:rounded-xl dark:shadow-black/70"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <span className="text-sm font-medium text-muted">{title}</span>
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
          {/* Icon + name */}
          <div className="flex items-start gap-2.5">
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setPickingIcon((v) => !v)}
                aria-label="Choose icon"
                aria-expanded={pickingIcon}
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border border-dashed border-line transition-colors hover:border-solid"
                style={{ color }}
              >
                <HabitIcon
                  icon={icon}
                  className="h-5 w-5"
                  fallback={<Pencil className="h-4 w-4 opacity-50" />}
                />
              </button>
              {pickingIcon && (
                <IconPicker
                  value={icon}
                  color={color}
                  onPick={(v) => {
                    setIcon(v)
                    setPickingIcon(false)
                  }}
                  onClose={() => setPickingIcon(false)}
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <input
                autoFocus
                value={name}
                maxLength={NAME_MAX}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submit()
                }}
                placeholder="e.g. Exercise 30min, Read 10 pages…"
                aria-label="Habit name"
                className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-base text-ink outline-none placeholder:text-faint focus:border-accent"
              />
              <span className="mt-1 flex items-center justify-between text-3xs">
                <span className="text-danger">{showErrors && nameError ? nameError : ''}</span>
                <span className="font-mono text-faint">
                  {name.length}/{NAME_MAX}
                </span>
              </span>
            </div>
          </div>

          {/* Templates */}
          {!templateMode && (
          <div>
            <button
              type="button"
              onClick={() => setBrowsing((v) => !v)}
              aria-expanded={browsing}
              className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-accent transition-opacity hover:opacity-80"
            >
              <Lightbulb className="h-3.5 w-3.5" />
              {browsing ? 'Hide templates' : 'Browse templates'}
              {templates.length > 0 && <span className="font-mono text-faint">{templates.length}</span>}
            </button>
            {browsing && (
              <div className="anim-fade-slide-in mt-2 rounded-lg border border-line bg-surface p-2">
                {templates.length === 0 ? (
                  <p className="px-1 py-3 text-center text-xs text-faint">
                    No templates yet. Build a habit you like, then save it as one.
                  </p>
                ) : (
                  <ul className="space-y-0.5" role="list">
                    {templates.map((t) => (
                      <li key={t.id} className="group flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => applyTemplate(t)}
                          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-raised"
                        >
                          <span
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded"
                            style={{ backgroundColor: `${t.color}22`, color: t.color }}
                          >
                            <HabitIcon icon={t.icon} className="h-3.5 w-3.5" />
                          </span>
                          <span className="min-w-0 flex-1 truncate text-xs text-ink">{t.name}</span>
                          <span className="shrink-0 font-mono text-3xs text-faint">
                            {t.trackBy === 'duration'
                              ? `${t.dailyTarget ?? 0}m`
                              : t.trackBy === 'count'
                                ? `×${t.dailyTarget ?? 1}`
                                : 'tick'}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteTemplate(t.id)}
                          aria-label={`Delete template ${t.name}`}
                          className="shrink-0 cursor-pointer rounded p-1 text-faint opacity-0 transition-opacity group-hover:opacity-100 hover:text-danger"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          )}

          {/* Repeat */}
          <div>
            <span className="mb-1.5 block text-xs font-medium text-faint">Repeat</span>
            <div role="radiogroup" aria-label="Repetition" className="flex flex-wrap gap-1.5">
              {(
                [
                  ['daily', 'Daily'],
                  ['weekdays', 'Weekdays'],
                  ['weekends', 'Weekends'],
                  ['pick', 'Pick days'],
                  ['perweek', 'X per week'],
                  ['monthly', 'Monthly'],
                ] as [Preset, string][]
              ).map(([value, label]) => (
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

            {repetitionType === 'timesPerWeek' && (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={timesPerWeek === n}
                    aria-label={`${n} times per week`}
                    onClick={() => setTimesPerWeek(n)}
                    className={`h-8 w-8 cursor-pointer rounded-md border font-mono text-xs transition-colors ${
                      timesPerWeek === n
                        ? 'border-accent/50 bg-accent-soft text-accent'
                        : 'border-line text-muted hover:text-ink'
                    }`}
                  >
                    {n}
                  </button>
                ))}
                <span className="ml-1 text-3xs text-faint">
                  any {timesPerWeek} days a week — the streak counts weeks
                </span>
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
                Dates after the 28th are skipped in months too short for them — February keeps the
                29th only in a leap year.
              </p>
            )}

            {showErrors && scheduleError && (
              <p className="mt-1.5 text-3xs text-danger">{scheduleError}</p>
            )}
          </div>

          {/* Track by */}
          <div>
            <span className="mb-1.5 block text-xs font-medium text-faint">Track by</span>
            <div role="radiogroup" aria-label="Track by" className="flex flex-wrap gap-1.5">
              {(
                [
                  ['checkoff', 'Checkoff'],
                  ['count', 'Target Count'],
                  ['duration', 'Target Duration'],
                ] as [TrackBy, string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={trackBy === value}
                  onClick={() => setTrackBy(value)}
                  className={`cursor-pointer rounded-md border px-3 py-1.5 text-xs transition-colors ${
                    trackBy === value
                      ? 'border-accent/50 bg-accent-soft font-medium text-ink'
                      : 'border-line text-muted hover:bg-surface hover:text-ink'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-3xs text-faint">
              {trackBy === 'checkoff'
                ? 'One tap finishes the day.'
                : trackBy === 'count'
                  ? 'Log several times a day — eight glasses of water.'
                  : 'Log minutes each day. Pick how long you want to practise daily.'}
            </p>

            {trackBy !== 'checkoff' && (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-faint">Per day</span>
                {(trackBy === 'duration' ? DURATION_PRESETS : [2, 3, 5, 8, 10]).map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={dailyTarget === String(n)}
                    onClick={() => setDailyTarget(String(n))}
                    className={`cursor-pointer rounded-md border px-2.5 py-1.5 font-mono text-3xs transition-colors ${
                      dailyTarget === String(n)
                        ? 'border-accent/50 bg-accent-soft text-accent'
                        : 'border-line text-muted hover:text-ink'
                    }`}
                  >
                    {trackBy === 'duration' ? (n >= 60 ? `${n / 60}h` : `${n}m`) : `×${n}`}
                  </button>
                ))}
                <input
                  type="number"
                  min={1}
                  value={dailyTarget}
                  onChange={(e) => setDailyTarget(e.target.value)}
                  placeholder={trackBy === 'duration' ? '30' : '8'}
                  aria-label="Per day target"
                  className="w-20 rounded-md border border-line bg-surface px-2.5 py-1.5 font-mono text-sm text-ink outline-none placeholder:text-faint focus:border-accent"
                />
                <span className="text-3xs text-faint">{targetLabel}</span>
              </div>
            )}
          </div>

          {/* Colour */}
          <div>
            <span className="mb-1.5 block text-xs font-medium text-faint">Colour</span>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Habit color">
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

          {/* Description + target streak */}
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-faint">Notes</span>
            <textarea
              value={description}
              maxLength={DESC_MAX}
              rows={2}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a short note…"
              className="w-full resize-none rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-faint focus:border-accent"
            />
          </label>

          {/* Remind */}
          <div>
            <span className="mb-1.5 block text-xs font-medium text-faint">Remind</span>
            {reminderTime ? (
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  aria-label="Reminder time"
                  className="rounded-md border border-line bg-surface px-2.5 py-1.5 font-mono text-sm text-ink outline-none focus:border-accent"
                />
                <span className="text-3xs text-faint">every day it is due</span>
                <button
                  type="button"
                  onClick={() => setReminderTime('')}
                  aria-label="Clear reminder"
                  className="cursor-pointer rounded p-1 text-faint transition-colors hover:text-danger"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setReminderTime('09:00')}
                className="cursor-pointer rounded-md border border-dashed border-line px-3 py-1.5 text-xs text-muted transition-colors hover:border-solid hover:text-ink"
              >
                + Add reminder
              </button>
            )}
          </div>

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

        <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3">
          {!templateMode && (
            <button
              type="button"
              disabled={!name.trim()}
              onClick={() => {
                onSaveTemplate(buildDraft())
                setSavedTemplate(true)
                window.setTimeout(() => setSavedTemplate(false), 2000)
              }}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-line px-2.5 py-2 text-xs font-medium text-muted transition-colors hover:bg-surface hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              <BookmarkPlus className="h-3.5 w-3.5" />
              {savedTemplate ? 'Saved' : 'Save as template'}
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
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
              {templateMode ? 'Save template' : habit ? 'Save changes' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
