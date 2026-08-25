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
import type { Habit } from '../types'
import { todayStr } from '../utils/dateUtils'
import { makeId } from '../utils/taskUtils'
import { LOCAL_SCOPE, loadHabits, saveHabits } from './storage'
import { useAuth } from './auth'
import { deleteHabitRow, loadHabitsFromServer, subscribeToHabits, upsertHabit } from './sync'

/**
 * Habits, following the same shape as the task and note stores: local state is
 * the fast path, localStorage is the per-account offline cache, Supabase is the
 * cross-device record.
 *
 * Writes go out immediately rather than on a debounce — a habit is edited a few
 * times a day, not on every keystroke, so there is nothing to coalesce.
 */

export type HabitDraft = Omit<Habit, 'id' | 'createdAt' | 'completedDates' | 'lastCompleted' | 'archivedAt'>

interface HabitStore {
  habits: Habit[]
  ready: boolean
  addHabit: (draft: HabitDraft) => Habit
  updateHabit: (id: string, patch: Partial<Omit<Habit, 'id' | 'createdAt'>>) => void
  deleteHabit: (id: string) => void
  /** Tick or untick a specific date. Idempotent per date. */
  toggleCompletion: (id: string, date?: string) => void
  setArchived: (id: string, archived: boolean) => void
}

const HabitContext = createContext<HabitStore | null>(null)

export function HabitProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id

  const [scope, setScope] = useState(LOCAL_SCOPE)
  const [habits, setHabits] = useState<Habit[]>(() => loadHabits(LOCAL_SCOPE) ?? [])
  const [ready, setReady] = useState(false)

  const seen = useRef(new Set<string>())

  useEffect(() => {
    if (authLoading) return
    const next = userId ?? LOCAL_SCOPE
    if (next === scope) return
    seen.current = new Set()
    setScope(next)
    setHabits(loadHabits(next) ?? [])
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
      const { habits: server, fromServer } = await loadHabitsFromServer(userId)
      if (cancelled) return
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
        completedDates: [],
        lastCompleted: null,
        archivedAt: null,
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

  const toggleCompletion = useCallback<HabitStore['toggleCompletion']>(
    (id, date = todayStr()) => {
      applyPatch(id, (h) => {
        const has = h.completedDates.includes(date)
        const completedDates = has
          ? h.completedDates.filter((d) => d !== date)
          : [...h.completedDates, date].sort()
        return {
          ...h,
          completedDates,
          // Unticking the most recent day should not leave a stale timestamp.
          lastCompleted: has
            ? completedDates.length
              ? (h.lastCompleted ?? null)
              : null
            : new Date().toISOString(),
        }
      })
    },
    [applyPatch],
  )

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
    () => ({ habits, ready, addHabit, updateHabit, deleteHabit, toggleCompletion, setArchived }),
    [habits, ready, addHabit, updateHabit, deleteHabit, toggleCompletion, setArchived],
  )

  return <HabitContext.Provider value={value}>{children}</HabitContext.Provider>
}

export function useHabits(): HabitStore {
  const ctx = useContext(HabitContext)
  if (!ctx) throw new Error('useHabits must be used within HabitProvider')
  return ctx
}
