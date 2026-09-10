import { Menu, Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Habit, HabitFilter, HabitTemplate } from '../types'
import { useHabits } from '../store/habitStore'
import { todayStr } from '../utils/dateUtils'
import { currentStreak, habitStats, isCompletedOn, requiredPerDay } from '../utils/habitUtils'
import { useWeekStart } from '../store/theme'
import { SUGGESTED_TEMPLATES } from '../store/habitTemplates'
import { EMPTY_PRESETS, EmptyState } from './EmptyState'
import { HabitCard } from './HabitCard'
import { HabitIcon } from './HabitIcon'
import { DayDetail } from './DayDetail'
import { HabitSummary } from './HabitSummary'
import { HabitForm } from './HabitForm'
import { nativeFeedback, nativeSelectionHaptic, nativeWarningHaptic } from '../native/platform'
import { commitHabitAmount } from '../utils/habitFeedback'
import { usePresenceValue } from './MotionPresence'

export function HabitTracker({
  onOpenMobileNav,
  filter = 'all',
  seedTemplate = null,
  editTemplate = null,
  onTemplateHandled,
}: {
  onOpenMobileNav: () => void
  filter?: HabitFilter
  /** A template chosen in the sidebar, to start a new habit from. */
  seedTemplate?: HabitTemplate | null
  /** A saved template chosen in the sidebar, to edit in place. */
  editTemplate?: HabitTemplate | null
  onTemplateHandled?: () => void
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
    updateTemplate,
    deleteTemplate,
  } = useHabits()
  const firstDay = useWeekStart()
  const [dragId, setDragId] = useState<string | null>(null)
  const [summary, setSummary] = useState<Habit | null>(null)
  const [day, setDay] = useState<{
    habit: Habit
    date: string
    anchor: { x: number; y: number }
  } | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Habit | null>(null)
  const [formAnchoredToAdd, setFormAnchoredToAdd] = useState(false)
  const addButtonRef = useRef<HTMLButtonElement>(null)
  const restoreAddFocusRef = useRef(false)
  const [toast, setToast] = useState<string | null>(null)
  const [flashId, setFlashId] = useState<string | null>(null)
  // The day just finished, and on which habit. Cleared on a timer so the same
  // box can go off again if the day is undone and redone.
  const [burst, setBurst] = useState<{ habitId: string; date: string } | null>(null)
  const dayPresence = usePresenceValue(day)
  const summaryPresence = usePresenceValue(summary)
  const formRequest = useMemo(
    () =>
      formOpen
        ? {
            key: editTemplate?.id ?? seedTemplate?.id ?? editing?.id ?? 'new',
            habit: editing,
            seed: editTemplate ?? seedTemplate,
            templateMode: editTemplate !== null,
            anchoredToAdd: formAnchoredToAdd,
          }
        : null,
    [editTemplate, editing, formAnchoredToAdd, formOpen, seedTemplate],
  )
  const formPresence = usePresenceValue(formRequest, {
    onExited: () => {
      if (!restoreAddFocusRef.current) return
      restoreAddFocusRef.current = false
      addButtonRef.current?.focus()
    },
  })
  const toastPresence = usePresenceValue(toast)

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

  useEffect(() => {
    if (!burst) return
    const t = setTimeout(() => setBurst(null), 750)
    return () => clearTimeout(t)
  }, [burst])

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
      // The writing habit is shown in Notes, where its days come from.
      if (h.source === 'notes') continue
      if (!matches(h)) continue
      ;(h.archivedAt ? b : a).push(h)
    }
    return { active: a, archived: b }
  }, [habits, filter])

  const dueToday = useMemo(
    () => active.filter((h) => habitStats(h, todayStr(), firstDay).dueToday),
    [active, firstDay],
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
      const streak = currentStreak(next, todayStr(), firstDay)
      setFlashId(habit.id)
      setBurst({ habitId: habit.id, date: target })
      setToast(
        habit.targetStreak !== null && streak === habit.targetStreak
          ? `${habit.name} · ${streak}-day target reached`
          : streak > 1
            ? `Nice — ${streak} in a row`
            : 'Logged. Day one.',
      )
    },
    [toggleCompletion, firstDay],
  )

  const handleAdjust = useCallback(
    (habit: Habit, delta: number, date?: string) => {
      const target = date ?? todayStr()
      const currentAmount = habit.logs[target] ?? 0
      const { amount: nextAmount, feedback } = commitHabitAmount({
        habit,
        date: target,
        operation: 'adjust',
        value: delta,
        feedback: nativeFeedback,
        mutate: (amount) => adjustCompletion(habit.id, amount - currentAmount, target),
      })
      const next: Habit = {
        ...habit,
        logs: { ...habit.logs, [target]: nextAmount },
      }
      if (delta <= 0 || feedback !== 'success') return
      const streak = currentStreak(next, todayStr(), firstDay)
      setFlashId(habit.id)
      setBurst({ habitId: habit.id, date: target })
      setToast(
        habit.targetStreak !== null && streak === habit.targetStreak
          ? `${habit.name} · ${streak}-day target reached`
          : streak > 1
            ? `Nice — ${streak} in a row`
            : 'Logged. Day one.',
      )
    },
    [adjustCompletion, firstDay],
  )

  const handleSetAmount = useCallback(
    (habit: Habit, amount: number, date?: string) => {
      const target = date ?? todayStr()
      const { amount: nextAmount, feedback } = commitHabitAmount({
        habit,
        date: target,
        operation: 'set',
        value: amount,
        feedback: nativeFeedback,
        mutate: (nextAmount) => setAmount(habit.id, nextAmount, target),
      })
      const next: Habit = { ...habit, logs: { ...habit.logs, [target]: nextAmount } }
      if (feedback !== 'success') return
      const streak = currentStreak(next, todayStr(), firstDay)
      setFlashId(habit.id)
      setBurst({ habitId: habit.id, date: target })
      setToast(streak > 1 ? `Nice — ${streak} in a row` : 'Logged. Day one.')
    },
    [setAmount, firstDay],
  )

  const handleDelete = useCallback(
    (habit: Habit) => {
      const days = Object.keys(habit.logs).length
      if (
        !window.confirm(
          `Delete “${habit.name}” and its history?\n\n${days} day${
            days === 1 ? '' : 's'
          } of history will be lost. To keep it instead, pause the routine.`,
        )
      )
        return
      nativeWarningHaptic()
      deleteHabit(habit.id)
    },
    [deleteHabit],
  )

  const quickAdd = (t: HabitTemplate) =>
    addHabit({
      name: t.name,
      description: t.description,
      repetitionType: t.repetitionType,
      daysOfWeek: t.daysOfWeek,
      datesOfMonth: t.datesOfMonth,
      color: t.color,
      icon: t.icon,
      targetStreak: null,
      reminderTime: null,
      timesPerWeek: t.timesPerWeek,
      trackBy: t.trackBy,
      dailyTarget: t.dailyTarget,
      source: 'manual',
    })

  // A template arriving from the sidebar opens the dialog: seeded for a new
  // habit, or on the template itself.
  useEffect(() => {
    if (!seedTemplate && !editTemplate) return
    restoreAddFocusRef.current = false
    setFormAnchoredToAdd(false)
    setEditing(null)
    setFormOpen(true)
  }, [seedTemplate, editTemplate])

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
          className="motion-interactive -ml-1 cursor-pointer rounded-md p-2 text-muted transition-colors hover:bg-surface hover:text-ink md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold tracking-[-0.02em] text-ink sm:text-2xl">
            My Routines
          </h1>
          <p className="mt-1 font-mono text-2xs tracking-[0.06em] text-faint uppercase">
            {dueToday.length > 0
              ? `${doneToday}/${dueToday.length} done today`
              : `${active.length} ${active.length === 1 ? 'routine' : 'routines'}`}
          </p>
        </div>
        <button
          ref={addButtonRef}
          type="button"
          aria-label="New routine"
          onClick={() => {
            nativeSelectionHaptic()
            restoreAddFocusRef.current = true
            setFormAnchoredToAdd(true)
            setEditing(null)
            setFormOpen(true)
          }}
          className="routine-header-add motion-primary motion-interactive inline-flex h-[30px] w-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-accent text-sm font-medium text-accent-ink hover:bg-accent-hi sm:h-auto sm:w-auto sm:px-3 sm:py-1.5"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          <span className="hidden sm:inline">New routine</span>
        </button>
      </header>

      {habits.length === 0 ? (
        <div>
          <EmptyState {...EMPTY_PRESETS.habits} />
          <div className="mx-auto flex max-w-sm flex-wrap justify-center gap-1.5">
            {SUGGESTED_TEMPLATES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => quickAdd(s)}
                className="motion-interactive cursor-pointer rounded-md border border-line px-2.5 py-1.5 text-xs text-muted transition-colors hover:border-accent/50 hover:text-ink"
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
          {active.map((h, index) => (
            <div
              key={h.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(h.id)}
              className={dragId && dragId !== h.id ? 'transition-transform' : ''}
            >
              <HabitCard
                habit={h}
                motionIndex={index}
                justCompleted={flashId === h.id}
                burstDate={burst?.habitId === h.id ? burst.date : null}
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
                onPickDay={(date, anchor) => setDay({ habit: h, date, anchor })}
                onSetNotes={(date, notes) => setLogNotes(h.id, date, notes)}
                onEdit={() => {
                  restoreAddFocusRef.current = false
                  setFormAnchoredToAdd(false)
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
            {archived.map((h, index) => (
              <HabitCard
                key={h.id}
                habit={h}
                motionIndex={index}
                justCompleted={false}
                burstDate={burst?.habitId === h.id ? burst.date : null}
                onToggle={(date) => handleToggle(h, date)}
                onAdjust={(delta, date) => handleAdjust(h, delta, date)}
                onSetAmount={(amount, date) => handleSetAmount(h, amount, date)}
                onSaveTemplate={() => saveAsTemplate(h)}
                onOpenSummary={() => setSummary(h)}
                onPickDay={(date, anchor) => setDay({ habit: h, date, anchor })}
                onSetNotes={(date, notes) => setLogNotes(h.id, date, notes)}
                onEdit={() => {
                  restoreAddFocusRef.current = false
                  setFormAnchoredToAdd(false)
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

      {dayPresence && (() => {
        const currentDay = dayPresence.value
        const h = habits.find((x) => x.id === currentDay.habit.id) ?? currentDay.habit
        return (
          <DayDetail
            habit={h}
            date={currentDay.date}
            today={todayStr()}
            anchor={currentDay.anchor}
            // A writing habit's days come from the notes, so annotating one
            // here would be overwritten on the next reconcile.
            editable={h.source !== 'notes'}
            onSetNotes={(notes) => setLogNotes(h.id, currentDay.date, notes)}
            onLogMinutes={(minutes) => handleAdjust(h, minutes, currentDay.date)}
            onClose={() => setDay(null)}
            phase={dayPresence.phase}
          />
        )
      })()}

      {summaryPresence && (
        <HabitSummary
          habit={habits.find((h) => h.id === summaryPresence.value.id) ?? summaryPresence.value}
          onClose={() => setSummary(null)}
          phase={summaryPresence.phase}
        />
      )}

      {formPresence && (
        <HabitForm
          key={formPresence.value.key}
          habit={formPresence.value.habit ?? undefined}
          seed={formPresence.value.seed ?? undefined}
          templateMode={formPresence.value.templateMode}
          anchorRef={formPresence.value.anchoredToAdd ? addButtonRef : undefined}
          templates={templates}
          onSaveTemplate={(draft) =>
            saveAsTemplate({ ...(formPresence.value.habit ?? ({} as Habit)), ...draft } as Habit)
          }
          onDeleteTemplate={deleteTemplate}
          onSave={(draft) => {
            const request = formPresence.value
            if (request.templateMode && request.seed) {
              updateTemplate(request.seed.id, draft)
              setFormOpen(false)
              onTemplateHandled?.()
              return
            }
            if (request.habit) updateHabit(request.habit.id, draft)
            else addHabit(draft)
            setFormOpen(false)
            setEditing(null)
            onTemplateHandled?.()
          }}
          onClose={() => {
            setFormOpen(false)
            setEditing(null)
            onTemplateHandled?.()
          }}
          phase={formPresence.phase}
        />
      )}

      {toastPresence && (
        <div
          role="status"
          data-motion-state={toastPresence.phase}
          className="motion-toast fixed bottom-20 left-1/2 z-50 -translate-x-1/2 sm:bottom-6"
        >
          <div className="motion-toast-inner rounded-lg border border-line bg-raised px-4 py-2.5 text-sm text-ink shadow-xl shadow-black/20 dark:shadow-black/70">
            {toastPresence.value}
          </div>
        </div>
      )}
    </>
  )
}
