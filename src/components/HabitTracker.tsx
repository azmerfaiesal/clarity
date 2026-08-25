import { Menu, Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Habit } from '../types'
import { useHabits, type HabitDraft } from '../store/habitStore'
import { todayStr } from '../utils/dateUtils'
import { currentStreak, habitStats } from '../utils/habitUtils'
import { EMPTY_PRESETS, EmptyState } from './EmptyState'
import { HabitCard } from './HabitCard'
import { HabitForm } from './HabitForm'

/** One-tap starting points so the empty state is not a blank wall. */
const SUGGESTIONS: { name: string; icon: string; color: string }[] = [
  { name: 'Exercise', icon: '💪', color: '#ff4d5e' },
  { name: 'Read', icon: '📚', color: '#3ddbf0' },
  { name: 'Meditate', icon: '🧘', color: '#a78bfa' },
  { name: 'Drink water', icon: '💧', color: '#4aa8ff' },
]

export function HabitTracker({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const { habits, addHabit, updateHabit, deleteHabit, toggleCompletion, setArchived } = useHabits()

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
    for (const h of habits) (h.archivedAt ? b : a).push(h)
    return { active: a, archived: b }
  }, [habits])

  const dueToday = useMemo(
    () => active.filter((h) => habitStats(h).dueToday),
    [active],
  )
  const doneToday = dueToday.filter((h) => h.completedDates.includes(todayStr())).length

  const handleToggle = useCallback(
    (habit: Habit, date?: string) => {
      const target = date ?? todayStr()
      const wasDone = habit.completedDates.includes(target)
      toggleCompletion(habit.id, target)
      if (wasDone) return

      // Recompute against the habit as it will be, so the toast reports the
      // streak the user is about to see rather than the previous one.
      const next: Habit = { ...habit, completedDates: [...habit.completedDates, target].sort() }
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

  const handleDelete = useCallback(
    (habit: Habit) => {
      if (
        !window.confirm(
          `Delete “${habit.name}” and its history?\n\n${habit.completedDates.length} completion${
            habit.completedDates.length === 1 ? '' : 's'
          } will be lost. To keep the history instead, pause the habit.`,
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
    })

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
            {SUGGESTIONS.map((s) => (
              <button
                key={s.name}
                type="button"
                onClick={() => quickAdd(s)}
                className="cursor-pointer rounded-md border border-line px-2.5 py-1.5 text-xs text-muted transition-colors hover:border-accent/50 hover:text-ink"
              >
                {s.icon} {s.name}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
          {active.map((h) => (
            <HabitCard
              key={h.id}
              habit={h}
              justCompleted={flashId === h.id}
              onToggle={(date) => handleToggle(h, date)}
              onEdit={() => {
                setEditing(h)
                setFormOpen(true)
              }}
              onDelete={() => handleDelete(h)}
              onArchive={(a) => setArchived(h.id, a)}
            />
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <div className="mt-9">
          <span className="label">Paused</span>
          <div className="mt-2 space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
            {archived.map((h) => (
              <HabitCard
                key={h.id}
                habit={h}
                justCompleted={false}
                onToggle={(date) => handleToggle(h, date)}
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

      {formOpen && (
        <HabitForm
          habit={editing ?? undefined}
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
