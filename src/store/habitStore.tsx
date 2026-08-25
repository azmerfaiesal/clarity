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
  loadTemplates,
  saveHabits,
  saveTemplates,
} from './storage'
import { useAuth } from './auth'
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
  'id' | 'createdAt' | 'logs' | 'lastCompleted' | 'archivedAt' | 'sortOrder'
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
  templates: HabitTemplate[]
  saveAsTemplate: (habit: Habit) => void
  deleteTemplate: (id: string) => void
  /** Tick every habit that tracks writing, for the given day. Idempotent. */
  recordWriting: (date?: string) => void
  /** Create the built-in Writing habit if the account has none. */
  addWritingHabit: () => void
}

const HabitContext = createContext<HabitStore | null>(null)

export function HabitProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id

  const [scope, setScope] = useState(LOCAL_SCOPE)
  const [habits, setHabits] = useState<Habit[]>(() => loadHabits(LOCAL_SCOPE) ?? [])
  const [templates, setTemplates] = useState<HabitTemplate[]>(
    () => loadTemplates(LOCAL_SCOPE) ?? [],
  )
  const [ready, setReady] = useState(false)

  const seen = useRef(new Set<string>())
  // Lets the log helpers read the latest habits without depending on them.
  const habitsRef = useRef<Habit[]>(habits)
  habitsRef.current = habits

  useEffect(() => {
    if (authLoading) return
    const next = userId ?? LOCAL_SCOPE
    if (next === scope) return
    seen.current = new Set()
    setScope(next)
    setHabits(loadHabits(next) ?? [])
    setTemplates(loadTemplates(next) ?? [])
    setReady(false)
  }, [authLoading, userId, scope])

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
      if (fromServer) {
        for (const h of server) seen.current.add(h.id)
        setHabits((local) => {
          const ids = new Set(server.map((h) => h.id))
          return [...server, ...local.filter((h) => !ids.has(h.id))]
        })
      }
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [authLoading, userId, ready])

  useEffect(() => {
    if (!userId || !ready) return
    return subscribeToHabits(userId, (server) => {
      const ids = new Set(server.map((h) => h.id))
      const removed = [...seen.current].filter((id) => !ids.has(id))
      removed.forEach((id) => seen.current.delete(id))
      ids.forEach((id) => seen.current.add(id))
      setHabits((local) => [
        ...server,
        ...local.filter((h) => !ids.has(h.id) && !removed.includes(h.id)),
      ])
    })
  }, [userId, ready])

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
        if (next > 0) logs[date] = next
        else delete logs[date]
        return {
          ...h,
          logs,
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

  const deleteTemplate = useCallback<HabitStore['deleteTemplate']>(
    (id) => {
      setTemplates((prev) => prev.filter((t) => t.id !== id))
      if (userId) deleteTemplateRow(id).catch(() => {})
    },
    [userId],
  )

  /**
   * Notes calls this after a note is saved. It only ever sets a day to done, so
   * writing twice in a day is not double-counted and an existing manual tick is
   * left alone.
   */
  const recordWriting = useCallback(
    (date: string = todayStr()) => {
      for (const h of habitsRef.current) {
        if (h.source !== 'notes' || h.archivedAt) continue
        if ((h.logs[date] ?? 0) >= requiredPerDay(h)) continue
        writeAmount(h.id, date, requiredPerDay(h), true)
      }
    },
    [writeAmount],
  )

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
      createdAt: now,
      logs: {},
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
      templates,
      saveAsTemplate,
      deleteTemplate,
      recordWriting,
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
      templates,
      saveAsTemplate,
      deleteTemplate,
      recordWriting,
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
