import { Menu, Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Habit, HabitFilter } from '../types'
import { useHabits, type HabitDraft } from '../store/habitStore'
import { todayStr } from '../utils/dateUtils'
import { currentStreak, habitStats, isCompletedOn, requiredPerDay } from '../utils/habitUtils'
import { EMPTY_PRESETS, EmptyState } from './EmptyState'
import { HabitCard } from './HabitCard'
import { HabitIcon } from './HabitIcon'
import { DayDetail } from './DayDetail'
import { HabitSummary } from './HabitSummary'
import { HabitForm } from './HabitForm'

/** One-tap starting points so the empty state is not a blank wall. */
const SUGGESTIONS: { name: string; icon: string; color: string }[] = [
  { name: 'Exercise', icon: 'lucide:dumbbell', color: '#fecaca' },
  { name: 'Read', icon: 'lucide:book', color: '#a5f3fc' },
  { name: 'Meditate', icon: 'lucide:brain', color: '#e9d5ff' },
  { name: 'Drink water', icon: 'lucide:water', color: '#bfdbfe' },
]

export function HabitTracker({
  onOpenMobileNav,
  filter = 'all',
}: {
  onOpenMobileNav: () => void
  filter?: HabitFilter
}) {
  const {
    habits,
    addHabit,
    updateHabit,
    deleteHabit,
    toggleCompletion,
    adjustCompletion,
    setAmount,
    setArchived,
    reorderHabits,
    setLogNotes,
    templates,
    saveAsTemplate,
    deleteTemplate,
    addWritingHabit,
  } = useHabits()
  const [dragId, setDragId] = useState<string | null>(null)
  const [summary, setSummary] = useState<Habit | null>(null)
  const [day, setDay] = useState<{ habitId: string; date: string; anchor: { x: number; y: number } } | null>(
    null,
  )

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Habit | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [flashId, setFlashId] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (!flashId) return
    const t = setTimeout(() => setFlashId(null), 900)
    return () => clearTimeout(t)
  }, [flashId])

  const { active, archived } = useMemo(() => {
    const a: Habit[] = []
    const b: Habit[] = []
    const matches = (h: Habit) =>
      filter === 'all' ||
      (filter === 'weekly'
        ? // Both fixed-day and per-week rules are "weekly" to a reader.
          h.repetitionType === 'weekly' || h.repetitionType === 'timesPerWeek'
        : h.repetitionType === filter)
    for (const h of [...habits].sort((x, y) => x.sortOrder - y.sortOrder)) {
      if (!matches(h)) continue
      ;(h.archivedAt ? b : a).push(h)
    }
    return { active: a, archived: b }
  }, [habits, filter])

  const dueToday = useMemo(
    () => active.filter((h) => habitStats(h).dueToday),
    [active],
  )
  const doneToday = dueToday.filter((h) => isCompletedOn(h, todayStr())).length

  const handleToggle = useCallback(
    (habit: Habit, date?: string) => {
      const target = date ?? todayStr()
      const wasDone = (habit.logs[target] ?? 0) > 0
      toggleCompletion(habit.id, target)
      if (wasDone) return

      // Recompute against the habit as it will be, so the toast reports the
      // streak the user is about to see rather than the previous one.
      const next: Habit = {
        ...habit,
        logs: { ...habit.logs, [target]: requiredPerDay(habit) },
      }
      const streak = currentStreak(next)
      setFlashId(habit.id)
      setToast(
        habit.targetStreak !== null && streak === habit.targetStreak
          ? `${habit.name} · ${streak}-day target reached 🎉`
          : streak > 1
            ? `Nice — ${streak} in a row`
            : 'Logged. Day one.',
      )
    },
    [toggleCompletion],
  )

  const handleAdjust = useCallback(
    (habit: Habit, delta: number, date?: string) => {
      const target = date ?? todayStr()
      adjustCompletion(habit.id, delta, target)
      if (delta <= 0) return
      // Announce only when this log is the one that finishes the day.
      const next: Habit = {
        ...habit,
        logs: { ...habit.logs, [target]: (habit.logs[target] ?? 0) + delta },
      }
      if (!isCompletedOn(next, target)) return
      if (isCompletedOn(habit, target)) return
      const streak = currentStreak(next)
      setFlashId(habit.id)
      setToast(
        habit.targetStreak !== null && streak === habit.targetStreak
          ? `${habit.name} · ${streak}-day target reached 🎉`
          : streak > 1
            ? `Nice — ${streak} in a row`
            : 'Logged. Day one.',
      )
    },
    [adjustCompletion],
  )

  const handleSetAmount = useCallback(
    (habit: Habit, amount: number, date?: string) => {
      const target = date ?? todayStr()
      const before = isCompletedOn(habit, target)
      setAmount(habit.id, amount, target)
      const next: Habit = { ...habit, logs: { ...habit.logs, [target]: amount } }
      if (before || !isCompletedOn(next, target)) return
      const streak = currentStreak(next)
      setFlashId(habit.id)
      setToast(streak > 1 ? `Nice — ${streak} in a row` : 'Logged. Day one.')
    },
    [setAmount],
  )

  const handleDelete = useCallback(
    (habit: Habit) => {
      const days = Object.keys(habit.logs).length
      if (
        !window.confirm(
          `Delete “${habit.name}” and its history?\n\n${days} day${
            days === 1 ? '' : 's'
          } of history will be lost. To keep it instead, pause the habit.`,
        )
      )
        return
      deleteHabit(habit.id)
    },
    [deleteHabit],
  )

  const handleSave = useCallback(
    (draft: HabitDraft) => {
      if (editing) updateHabit(editing.id, draft)
      else addHabit(draft)
      setFormOpen(false)
      setEditing(null)
    },
    [editing, updateHabit, addHabit],
  )

  const quickAdd = (s: (typeof SUGGESTIONS)[number]) =>
    addHabit({
      name: s.name,
      description: '',
      repetitionType: 'daily',
      daysOfWeek: [],
      datesOfMonth: [],
      color: s.color,
      icon: s.icon,
      targetStreak: null,
      reminderTime: null,
      timesPerWeek: null,
      trackBy: 'checkoff',
      dailyTarget: null,
      source: 'manual',
    })

  // HTML5 drag, so no dependency and pointer/keyboard fall back to the menu.
  const onDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return
    const ids = active.map((h) => h.id)
    const from = ids.indexOf(dragId)
    const to = ids.indexOf(targetId)
    if (from === -1 || to === -1) return
    ids.splice(to, 0, ids.splice(from, 1)[0])
    reorderHabits(ids)
    setDragId(null)
  }

  return (
    <>
      <header className="flex items-center gap-2 pt-6 pb-6 sm:pt-10">
        <button
          type="button"
          onClick={onOpenMobileNav}
          aria-label="Open navigation"
          className="-ml-1 cursor-pointer rounded-md p-2 text-muted transition-colors hover:bg-surface hover:text-ink md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold tracking-[-0.02em] text-ink sm:text-2xl">
            Your Habits
          </h1>
          <p className="mt-1 font-mono text-2xs tracking-[0.06em] text-faint uppercase">
            {dueToday.length > 0
              ? `${doneToday}/${dueToday.length} done today`
              : `${active.length} ${active.length === 1 ? 'habit' : 'habits'}`}
          </p>
        </div>
        {!habits.some((h) => h.source === 'notes') && (
          <button
            type="button"
            onClick={addWritingHabit}
            title="Add a Writing habit that ticks itself when you add a note"
            className="mr-1.5 hidden cursor-pointer rounded-md border border-line px-2.5 py-1.5 text-xs text-muted transition-colors hover:border-accent/50 hover:text-ink sm:inline-flex"
          >
            + Writing
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink transition-all hover:bg-accent-hi hover:glow-sm"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          <span className="hidden sm:inline">New habit</span>
        </button>
      </header>

      {habits.length === 0 ? (
        <div>
          <EmptyState {...EMPTY_PRESETS.habits} />
          <div className="mx-auto flex max-w-sm flex-wrap justify-center gap-1.5">
            <button
              type="button"
              onClick={addWritingHabit}
              title="Ticks itself whenever you add a note"
              className="cursor-pointer rounded-md border border-line px-2.5 py-1.5 text-xs text-muted transition-colors hover:border-accent/50 hover:text-ink"
            >
              <span className="inline-flex items-center gap-1.5">
                <HabitIcon icon="lucide:pen" className="h-3.5 w-3.5" />
                Writing
                <span className="text-3xs text-faint">auto</span>
              </span>
            </button>
            {SUGGESTIONS.map((s) => (
              <button
                key={s.name}
                type="button"
                onClick={() => quickAdd(s)}
                className="cursor-pointer rounded-md border border-line px-2.5 py-1.5 text-xs text-muted transition-colors hover:border-accent/50 hover:text-ink"
              >
                <span className="inline-flex items-center gap-1.5">
                  <HabitIcon icon={s.icon} className="h-3.5 w-3.5" />
                  {s.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {active.map((h) => (
            <div
              key={h.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(h.id)}
              className={dragId && dragId !== h.id ? 'transition-transform' : ''}
            >
              <HabitCard
                habit={h}
                justCompleted={flashId === h.id}
                dragging={dragId === h.id}
                dragHandleProps={{
                  draggable: true,
                  onDragStart: () => setDragId(h.id),
                  onDragEnd: () => setDragId(null),
                }}
                onToggle={(date) => handleToggle(h, date)}
                onAdjust={(delta, date) => handleAdjust(h, delta, date)}
                onSetAmount={(amount, date) => handleSetAmount(h, amount, date)}
                onSaveTemplate={() => saveAsTemplate(h)}
                onOpenSummary={() => setSummary(h)}
                onPickDay={(date, anchor) => setDay({ habitId: h.id, date, anchor })}
                onEdit={() => {
                  setEditing(h)
                  setFormOpen(true)
                }}
                onDelete={() => handleDelete(h)}
                onArchive={(a) => setArchived(h.id, a)}
              />
            </div>
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <div className="mt-9">
          <span className="label">Paused</span>
          <div className="mt-2 space-y-3">
            {archived.map((h) => (
              <HabitCard
                key={h.id}
                habit={h}
                justCompleted={false}
                onToggle={(date) => handleToggle(h, date)}
                onAdjust={(delta, date) => handleAdjust(h, delta, date)}
                onSetAmount={(amount, date) => handleSetAmount(h, amount, date)}
                onSaveTemplate={() => saveAsTemplate(h)}
                onOpenSummary={() => setSummary(h)}
                onPickDay={(date, anchor) => setDay({ habitId: h.id, date, anchor })}
                onEdit={() => {
                  setEditing(h)
                  setFormOpen(true)
                }}
                onDelete={() => handleDelete(h)}
                onArchive={(a) => setArchived(h.id, a)}
              />
            ))}
          </div>
        </div>
      )}

      {day && (() => {
        const h = habits.find((x) => x.id === day.habitId)
        if (!h) return null
        return (
          <DayDetail
            habit={h}
            date={day.date}
            today={todayStr()}
            anchor={day.anchor}
            // A writing habit's days come from the notes, so annotating one
            // here would be overwritten on the next reconcile.
            editable={h.source !== 'notes'}
            onSetNotes={(notes) => setLogNotes(h.id, day.date, notes)}
            onClose={() => setDay(null)}
          />
        )
      })()}

      {summary && (
        <HabitSummary
          habit={habits.find((h) => h.id === summary.id) ?? summary}
          onClose={() => setSummary(null)}
        />
      )}

      {formOpen && (
        <HabitForm
          habit={editing ?? undefined}
          templates={templates}
          onSaveTemplate={(draft) =>
            saveAsTemplate({ ...(editing ?? ({} as Habit)), ...draft } as Habit)
          }
          onDeleteTemplate={deleteTemplate}
          onSave={handleSave}
          onClose={() => {
            setFormOpen(false)
            setEditing(null)
          }}
        />
      )}

      {toast && (
        <div
          role="status"
          className="anim-toast-in fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-line bg-raised px-4 py-2.5 text-sm text-ink shadow-xl shadow-black/20 sm:bottom-6 dark:shadow-black/70"
        >
          {toast}
        </div>
      )}
    </>
  )
}
