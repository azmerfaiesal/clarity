import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Habit, HabitTemplate } from '../types'
import { todayStr } from '../utils/dateUtils'
import { requiredPerDay } from '../utils/habitUtils'
import { makeId } from '../utils/taskUtils'
import {
  LOCAL_SCOPE,
  loadHabits,
  loadSyncedIds,
  loadTemplates,
  saveHabits,
  saveSyncedIds,
  saveTemplates,
} from './storage'
import { useAuth } from './auth'
import { onRevalidate } from './revalidate'
import { mergeSnapshot } from './merge'
import { useNotes } from './noteStore'
import {
  deleteHabitRow,
  deleteTemplateRow,
  loadHabitsFromServer,
  loadTemplatesFromServer,
  subscribeToHabits,
  upsertHabit,
  upsertTemplate,
} from './sync'

/**
 * Habits, following the same shape as the task and note stores: local state is
 * the fast path, localStorage is the per-account offline cache, Supabase is the
 * cross-device record.
 *
 * Writes go out immediately rather than on a debounce — a habit is edited a few
 * times a day, not on every keystroke, so there is nothing to coalesce.
 */

export type HabitDraft = Omit<
  Habit,
  'id' | 'createdAt' | 'logs' | 'logNotes' | 'lastCompleted' | 'archivedAt' | 'sortOrder'
> &
  Partial<Pick<Habit, 'sortOrder'>>

interface HabitStore {
  habits: Habit[]
  ready: boolean
  addHabit: (draft: HabitDraft) => Habit
  updateHabit: (id: string, patch: Partial<Omit<Habit, 'id' | 'createdAt'>>) => void
  deleteHabit: (id: string) => void
  /** Tick or untick a whole date. */
  toggleCompletion: (id: string, date?: string) => void
  /** Add to (or subtract from) a date's amount. */
  adjustCompletion: (id: string, delta: number, date?: string) => void
  /** Set a date's amount outright — what the hold-to-log slider commits. */
  setAmount: (id: string, amount: number, date?: string) => void
  setArchived: (id: string, archived: boolean) => void
  /** Move a habit to a new position in the manual order. */
  reorderHabits: (ids: string[]) => void
  /** Replace the notes describing a day's logs. */
  setLogNotes: (id: string, date: string, notes: string[]) => void
  templates: HabitTemplate[]
  saveAsTemplate: (habit: Habit) => void
  /** Rewrite a saved template in place, keeping its id and creation date. */
  updateTemplate: (id: string, draft: HabitDraft) => void
  deleteTemplate: (id: string) => void
  /** Create the built-in Writing habit if the account has none. */
  addWritingHabit: () => void
}

const HabitContext = createContext<HabitStore | null>(null)

export function HabitProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  // HabitProvider sits inside NoteProvider, so writing habits can be derived
  // from the notes rather than told about them.
  const { notes } = useNotes()
  const userId = user?.id

  const [scope, setScope] = useState(LOCAL_SCOPE)
  const [habits, setHabits] = useState<Habit[]>(() => loadHabits(LOCAL_SCOPE) ?? [])
  const [templates, setTemplates] = useState<HabitTemplate[]>(
    () => loadTemplates(LOCAL_SCOPE) ?? [],
  )
  const [ready, setReady] = useState(false)

  // Ids the server is known to have. Persisted, because on a cold start an
  // empty set makes every locally cached habit look like one created offline —
  // including the ones another device deleted while this one was closed, which
  // is how a device ends up showing habits that no longer exist.
  const seen = useRef(new Set<string>(loadSyncedIds(LOCAL_SCOPE, 'habits') ?? []))
  // Lets the log helpers read the latest habits without depending on them.
  const habitsRef = useRef<Habit[]>(habits)
  habitsRef.current = habits

  useEffect(() => {
    if (authLoading) return
    const next = userId ?? LOCAL_SCOPE
    if (next === scope) return
    seen.current = new Set(loadSyncedIds(next, 'habits') ?? [])
    setScope(next)
    setHabits(loadHabits(next) ?? [])
    setTemplates(loadTemplates(next) ?? [])
    setReady(false)
  }, [authLoading, userId, scope])

  /**
   * Take a server snapshot as the truth, and decide what to do with anything
   * local that is not in it.
   *
   * A local row the server has never had is one created here, offline: keep it,
   * and push it so it stops being orphaned. A local row the server *did* have
   * is one another device deleted: let it go. `seen` is the only thing that
   * tells those two apart, which is why it outlives the page.
   */
  const applySnapshot = useCallback(
    (server: Habit[]) => {
      const known = seen.current
      setHabits((local) => {
        const { rows, orphans } = mergeSnapshot(server, local, known)
        // Re-push, in case the original push is what failed and left it here.
        if (userId) for (const h of orphans) upsertHabit(h, userId).catch(() => {})
        return rows
      })
      const ids = new Set(server.map((h) => h.id))
      seen.current = ids
      saveSyncedIds(userId ?? LOCAL_SCOPE, 'habits', [...ids])
    },
    [userId],
  )

  useEffect(() => {
    if (authLoading || ready) return
    if (!userId) {
      setReady(true)
      return
    }
    let cancelled = false
    void (async () => {
      const [{ habits: server, fromServer }, { templates: serverTemplates }] = await Promise.all([
        loadHabitsFromServer(userId),
        loadTemplatesFromServer(userId),
      ])
      if (cancelled) return
      if (serverTemplates.length) setTemplates(serverTemplates)
      if (fromServer) applySnapshot(server)
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [authLoading, userId, ready])

  // Realtime, plus a re-read whenever the socket cannot have kept up.
  useEffect(() => {
    if (!userId || !ready) return
    const sub = subscribeToHabits(
      userId,
      applySnapshot,
      // Templates have no local-only lifecycle to protect: the server list is
      // the list, so a snapshot replaces it outright.
      (server) => setTemplates(server),
    )
    const off = onRevalidate(sub.refresh)
    return () => {
      off()
      sub.stop()
    }
  }, [userId, ready, applySnapshot])

  useEffect(() => {
    saveHabits(scope, habits)
  }, [scope, habits])

  useEffect(() => {
    saveTemplates(scope, templates)
  }, [scope, templates])

  const push = useCallback(
    (habit: Habit) => {
      if (!userId) return
      upsertHabit(habit, userId)
        .then(() => seen.current.add(habit.id))
        .catch(() => {})
    },
    [userId],
  )

  const addHabit = useCallback<HabitStore['addHabit']>(
    (draft) => {
      const habit: Habit = {
        ...draft,
        id: makeId(),
        createdAt: new Date().toISOString(),
        logs: {},
        logNotes: {},
        lastCompleted: null,
        archivedAt: null,
        sortOrder: draft.sortOrder ?? Date.now(),
      }
      setHabits((prev) => [...prev, habit])
      push(habit)
      return habit
    },
    [push],
  )

  const applyPatch = useCallback(
    (id: string, patch: (h: Habit) => Habit) => {
      setHabits((prev) => {
        const next = prev.map((h) => (h.id === id ? patch(h) : h))
        const changed = next.find((h) => h.id === id)
        if (changed) push(changed)
        return next
      })
    },
    [push],
  )

  const updateHabit = useCallback<HabitStore['updateHabit']>(
    (id, patch) => {
      // createdAt is deliberately not patchable — the streak maths walks from it.
      applyPatch(id, (h) => ({ ...h, ...patch }))
    },
    [applyPatch],
  )

  /** Write one date's amount, dropping the key when it falls to zero. */
  const writeAmount = useCallback(
    (id: string, date: string, next: number, touched: boolean) => {
      applyPatch(id, (h) => {
        const logs = { ...h.logs }
        const logNotes = { ...h.logNotes }
        if (next > 0) logs[date] = next
        else {
          delete logs[date]
          // A day with nothing logged has nothing to describe.
          delete logNotes[date]
        }
        return {
          ...h,
          logs,
          logNotes,
          // Clearing the last entry should not leave a stale timestamp behind.
          lastCompleted: touched
            ? new Date().toISOString()
            : Object.keys(logs).length
              ? h.lastCompleted
              : null,
        }
      })
    },
    [applyPatch],
  )

  const toggleCompletion = useCallback<HabitStore['toggleCompletion']>(
    (id, date = todayStr()) => {
      const h = habitsRef.current.find((x) => x.id === id)
      if (!h) return
      const has = (h.logs[date] ?? 0) > 0
      // Untick clears the day outright, whatever amount it held.
      writeAmount(id, date, has ? 0 : requiredPerDay(h), !has)
    },
    [writeAmount],
  )

  const adjustCompletion = useCallback<HabitStore['adjustCompletion']>(
    (id, delta, date = todayStr()) => {
      const h = habitsRef.current.find((x) => x.id === id)
      if (!h) return
      const next = Math.max(0, (h.logs[date] ?? 0) + delta)
      writeAmount(id, date, next, delta > 0)
    },
    [writeAmount],
  )

  const setAmount = useCallback<HabitStore['setAmount']>(
    (id, amount, date = todayStr()) => {
      const h = habitsRef.current.find((x) => x.id === id)
      if (!h) return
      const next = Math.max(0, Math.round(amount))
      writeAmount(id, date, next, next > (h.logs[date] ?? 0))
    },
    [writeAmount],
  )

  const setLogNotes = useCallback<HabitStore['setLogNotes']>(
    (id, date, notes) => {
      applyPatch(id, (h) => {
        const logNotes = { ...h.logNotes }
        const cleaned = notes.map((n) => n.trim()).filter(Boolean)
        if (cleaned.length) logNotes[date] = cleaned
        else delete logNotes[date]
        return { ...h, logNotes }
      })
    },
    [applyPatch],
  )

  const reorderHabits = useCallback<HabitStore['reorderHabits']>(
    (ids) => {
      setHabits((prev) => {
        const order = new Map(ids.map((id, i) => [id, i]))
        const next = prev.map((h) =>
          order.has(h.id) ? { ...h, sortOrder: order.get(h.id)! } : h,
        )
        // Push only the rows whose position actually moved.
        for (const h of next) {
          const before = prev.find((p) => p.id === h.id)
          if (before && before.sortOrder !== h.sortOrder) push(h)
        }
        return next
      })
    },
    [push],
  )

  const saveAsTemplate = useCallback<HabitStore['saveAsTemplate']>(
    (habit) => {
      const template: HabitTemplate = {
        id: makeId(),
        name: habit.name,
        description: habit.description,
        icon: habit.icon,
        color: habit.color,
        repetitionType: habit.repetitionType,
        daysOfWeek: habit.daysOfWeek,
        datesOfMonth: habit.datesOfMonth,
        timesPerWeek: habit.timesPerWeek,
        trackBy: habit.trackBy,
        dailyTarget: habit.dailyTarget,
        createdAt: new Date().toISOString(),
      }
      setTemplates((prev) => [template, ...prev])
      if (userId) upsertTemplate(template, userId).catch(() => {})
    },
    [userId],
  )

  const updateTemplate = useCallback<HabitStore['updateTemplate']>(
    (id, draft) => {
      setTemplates((prev) => {
        const next = prev.map((t) =>
          t.id === id
            ? {
                ...t,
                name: draft.name,
                description: draft.description,
                icon: draft.icon,
                color: draft.color,
                repetitionType: draft.repetitionType,
                daysOfWeek: draft.daysOfWeek,
                datesOfMonth: draft.datesOfMonth,
                timesPerWeek: draft.timesPerWeek,
                trackBy: draft.trackBy,
                dailyTarget: draft.dailyTarget,
              }
            : t,
        )
        const changed = next.find((t) => t.id === id)
        // Upsert rather than a second update path: the row already exists, and
        // the same call created it.
        if (changed && userId) upsertTemplate(changed, userId).catch(() => {})
        return next
      })
    },
    [userId],
  )

  const deleteTemplate = useCallback<HabitStore['deleteTemplate']>(
    (id) => {
      setTemplates((prev) => prev.filter((t) => t.id !== id))
      if (userId) deleteTemplateRow(id).catch(() => {})
    },
    [userId],
  )

  /**
   * Reconcile any writing-tracked habit against the notes themselves.
   *
   * Deriving rather than recording at save time means the habit is right by
   * construction: notes written before the habit existed show up in its
   * history, and deleting a note takes its day back. Recording on save could
   * only ever have described the future, and would drift the moment a note was
   * removed.
   */
  useEffect(() => {
    if (!ready) return
    const writing = habitsRef.current.filter((h) => h.source === 'notes')
    if (writing.length === 0) return

    // A note belongs to the local day it was created on.
    const days = new Set(notes.map((n) => n.createdAt.slice(0, 10)))

    for (const h of writing) {
      const current = Object.keys(h.logs)
      const missing = [...days].filter((d) => !(h.logs[d] > 0))
      const stale = current.filter((d) => !days.has(d))
      if (missing.length === 0 && stale.length === 0) continue

      const logs: Record<string, number> = {}
      for (const d of days) logs[d] = 1
      applyPatch(h.id, (habit) => ({
        ...habit,
        logs,
        lastCompleted: days.size
          ? [...days].sort().reverse()[0] + 'T00:00:00.000Z'
          : null,
      }))
    }
  }, [notes, ready, applyPatch])

  const addWritingHabit = useCallback(() => {
    if (habitsRef.current.some((h) => h.source === 'notes')) return
    const now = new Date().toISOString()
    const habit: Habit = {
      id: makeId(),
      name: 'Writing',
      description: 'Ticks itself on any day you add a note.',
      repetitionType: 'daily',
      daysOfWeek: [],
      datesOfMonth: [],
      timesPerWeek: null,
      trackBy: 'checkoff',
      dailyTarget: null,
      color: '#c084fc',
      icon: 'lucide:pen',
      targetStreak: null,
      reminderTime: null,
      createdAt: now,
      logs: {},
      logNotes: {},
      lastCompleted: null,
      archivedAt: null,
      sortOrder: Date.now(),
      source: 'notes',
    }
    setHabits((prev) => [...prev, habit])
    push(habit)
  }, [push])

  const setArchived = useCallback<HabitStore['setArchived']>(
    (id, archived) => {
      applyPatch(id, (h) => ({ ...h, archivedAt: archived ? new Date().toISOString() : null }))
    },
    [applyPatch],
  )

  const deleteHabit = useCallback<HabitStore['deleteHabit']>(
    (id) => {
      setHabits((prev) => prev.filter((h) => h.id !== id))
      seen.current.delete(id)
      if (userId) deleteHabitRow(id).catch(() => {})
    },
    [userId],
  )

  const value = useMemo<HabitStore>(
    () => ({
      habits,
      ready,
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
      addWritingHabit,
    }),
    [
      habits,
      ready,
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
      addWritingHabit,
    ],
  )

  return <HabitContext.Provider value={value}>{children}</HabitContext.Provider>
}

export function useHabits(): HabitStore {
  const ctx = useContext(HabitContext)
  if (!ctx) throw new Error('useHabits must be used within HabitProvider')
  return ctx
}
