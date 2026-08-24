import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react'
import type { Priority, Task, TaskList } from '../types'
import { makeId } from '../utils/taskUtils'
import {
  LOCAL_SCOPE,
  clearScope,
  loadLists,
  loadTasks,
  saveLists,
  saveTasks,
  seedLists,
  seedTasks,
} from './storage'
import { useAuth } from './auth'
import {
  deleteListRow,
  deleteTaskRow,
  loadFromServer,
  subscribeToChanges,
  upsertList,
  upsertTask,
} from './sync'

/**
 * Single source of truth for tasks and lists.
 *
 * Local state is the fast path; localStorage is the offline cache; Supabase is
 * the cross-device record. Writes flow one way — reducer -> local cache ->
 * debounced upsert of *changed rows only* — and realtime pushes other devices'
 * changes back in.
 */

interface State {
  /** Cache namespace: the signed-in user's id, or `local` before sign-in. */
  scope: string
  tasks: Task[]
  lists: TaskList[]
  lastDeleted: { task: Task } | null
  /** False until the first server read for this scope has settled. */
  ready: boolean
}

type Action =
  | { type: 'SET_SCOPE'; scope: string; tasks: Task[]; lists: TaskList[] }
  | {
      type: 'MERGE_SERVER'
      scope: string
      tasks: Task[]
      lists: TaskList[]
      /** Rows the server no longer has — deleted on another device. */
      removeTaskIds?: string[]
      removeListIds?: string[]
    }
  | { type: 'SEED'; scope: string }
  | { type: 'READY'; scope: string }
  | { type: 'ADD_TASK'; task: Task }
  | { type: 'UPDATE_TASK'; id: string; patch: Partial<Task> }
  | { type: 'DELETE_TASK'; id: string }
  | { type: 'UNDO_DELETE' }
  | { type: 'RESTORE_FROM_TRASH'; id: string }
  | { type: 'PERMANENT_DELETE'; id: string }
  | { type: 'EMPTY_TRASH' }
  | { type: 'CLEAR_UNDO' }
  | { type: 'TOGGLE_COMPLETE'; id: string }
  | { type: 'TOGGLE_FAVORITE'; id: string }
  | { type: 'DUPLICATE_TASK'; id: string }
  | { type: 'CLEAR_COMPLETED' }
  | { type: 'ADD_LIST'; list: TaskList }
  | { type: 'DELETE_LIST'; id: string }
  | { type: 'UPDATE_LIST'; id: string; patch: { name?: string; color?: string } }

/** Server rows win per id; rows only we know about (created offline) survive. */
function mergeById<T extends { id: string }>(server: T[], local: T[]): T[] {
  const serverIds = new Set(server.map((r) => r.id))
  return [...server, ...local.filter((r) => !serverIds.has(r.id))]
}

/**
 * Refresh the synced-row bookkeeping against a fresh server snapshot and return
 * the ids that vanished — rows another device deleted for good.
 */
function reconcile<T extends { id: string }>(synced: Map<string, T>, server: T[]): string[] {
  const serverIds = new Set(server.map((r) => r.id))
  const removed = [...synced.keys()].filter((id) => !serverIds.has(id))
  for (const id of removed) synced.delete(id)
  for (const row of server) synced.set(row.id, row)
  return removed
}

function reducer(state: State, action: Action): State {
  const now = new Date().toISOString()

  switch (action.type) {
    case 'SET_SCOPE':
      return {
        scope: action.scope,
        tasks: action.tasks,
        lists: action.lists,
        lastDeleted: null,
        ready: false,
      }

    // Stale async results are dropped: the scope may have changed underneath.
    case 'MERGE_SERVER': {
      if (action.scope !== state.scope) return state
      const droppedTasks = new Set(action.removeTaskIds ?? [])
      const droppedLists = new Set(action.removeListIds ?? [])
      return {
        ...state,
        tasks: mergeById(
          action.tasks,
          droppedTasks.size ? state.tasks.filter((t) => !droppedTasks.has(t.id)) : state.tasks,
        ),
        lists: mergeById(
          action.lists,
          droppedLists.size ? state.lists.filter((l) => !droppedLists.has(l.id)) : state.lists,
        ),
      }
    }

    case 'SEED':
      if (action.scope !== state.scope) return state
      return { ...state, tasks: seedTasks(), lists: seedLists() }

    case 'READY':
      if (action.scope !== state.scope) return state
      return { ...state, ready: true }

    case 'ADD_TASK':
      return { ...state, tasks: [...state.tasks, action.task] }

    case 'UPDATE_TASK':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.id ? { ...t, ...action.patch, updatedAt: now } : t,
        ),
      }

    case 'DELETE_TASK': {
      const task = state.tasks.find((t) => t.id === action.id)
      if (!task || task.deletedAt !== null) return state
      return {
        ...state,
        // Soft delete: move to the recycle bin instead of dropping the row.
        tasks: state.tasks.map((t) =>
          t.id === action.id ? { ...t, deletedAt: now, updatedAt: now } : t,
        ),
        lastDeleted: { task },
      }
    }

    case 'UNDO_DELETE': {
      if (!state.lastDeleted) return state
      const { id } = state.lastDeleted.task
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === id ? { ...t, deletedAt: null, updatedAt: now } : t,
        ),
        lastDeleted: null,
      }
    }

    case 'RESTORE_FROM_TRASH':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.id ? { ...t, deletedAt: null, updatedAt: now } : t,
        ),
        lastDeleted: state.lastDeleted?.task.id === action.id ? null : state.lastDeleted,
      }

    // Hard deletes just drop the row; the sync effect notices the id is gone
    // and issues the matching server delete.
    case 'PERMANENT_DELETE':
      return {
        ...state,
        tasks: state.tasks.filter((t) => t.id !== action.id),
        lastDeleted: state.lastDeleted?.task.id === action.id ? null : state.lastDeleted,
      }

    case 'EMPTY_TRASH':
      return {
        ...state,
        tasks: state.tasks.filter((t) => t.deletedAt === null),
        lastDeleted: null,
      }

    case 'CLEAR_UNDO':
      return state.lastDeleted ? { ...state, lastDeleted: null } : state

    case 'TOGGLE_COMPLETE':
      return {
        ...state,
        tasks: state.tasks.map((t) => {
          if (t.id !== action.id) return t
          const completed = !t.completed
          return { ...t, completed, completedAt: completed ? now : null, updatedAt: now }
        }),
      }

    case 'TOGGLE_FAVORITE':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.id ? { ...t, favorite: !t.favorite, updatedAt: now } : t,
        ),
      }

    case 'DUPLICATE_TASK': {
      const source = state.tasks.find((t) => t.id === action.id)
      if (!source) return state
      const copy: Task = {
        ...source,
        id: makeId(),
        title: `${source.title} (copy)`,
        completed: false,
        completedAt: null,
        deletedAt: null,
        sortOrder: Date.now(),
        createdAt: now,
        updatedAt: now,
      }
      return { ...state, tasks: [...state.tasks, copy] }
    }

    // Clearing completed moves them to the recycle bin rather than destroying
    // them — recoverable, and the soft-delete syncs like any other edit.
    case 'CLEAR_COMPLETED':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.completed && t.deletedAt === null ? { ...t, deletedAt: now, updatedAt: now } : t,
        ),
      }

    case 'ADD_LIST':
      return { ...state, lists: [...state.lists, action.list] }

    case 'DELETE_LIST':
      return {
        ...state,
        lists: state.lists.filter((l) => l.id !== action.id),
        // Orphaned tasks fall back to Inbox.
        tasks: state.tasks.map((t) =>
          t.listId === action.id ? { ...t, listId: null, updatedAt: now } : t,
        ),
      }

    case 'UPDATE_LIST': {
      const patch = { ...action.patch }
      if (patch.name !== undefined) patch.name = patch.name.trim()
      if (!patch.name) delete patch.name
      return {
        ...state,
        lists: state.lists.map((l) => (l.id === action.id ? { ...l, ...patch } : l)),
      }
    }

    default:
      return state
  }
}

function initState(): State {
  return {
    scope: LOCAL_SCOPE,
    tasks: loadTasks(LOCAL_SCOPE) ?? [],
    lists: loadLists(LOCAL_SCOPE) ?? [],
    lastDeleted: null,
    ready: false,
  }
}

export interface TaskStore {
  tasks: Task[]
  lists: TaskList[]
  lastDeleted: State['lastDeleted']
  /** True once this account's server data has loaded (or failed to). */
  ready: boolean
  addTask: (input: {
    title: string
    description?: string
    priority?: Priority
    dueDate?: string | null
    listId?: string | null
    tags?: string[]
    reminder?: string | null
  }) => Task
  updateTask: (id: string, patch: Partial<Task>) => void
  deleteTask: (id: string) => void
  undoDelete: () => void
  restoreTask: (id: string) => void
  permanentDelete: (id: string) => void
  emptyTrash: () => void
  clearUndo: () => void
  toggleComplete: (id: string) => void
  toggleFavorite: (id: string) => void
  duplicateTask: (id: string) => void
  clearCompleted: () => void
  addList: (name: string, color: string) => TaskList
  deleteList: (id: string) => void
  updateList: (id: string, patch: { name?: string; color?: string }) => void
}

const TaskContext = createContext<TaskStore | null>(null)

export function TaskProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id
  const [state, dispatch] = useReducer(reducer, undefined, initState)

  const { scope, ready } = state

  // Rows we know the server already has, keyed by id. Identity comparison
  // against these tells us exactly which rows changed since the last push.
  const syncedTasks = useRef(new Map<string, Task>())
  const syncedLists = useRef(new Map<string, TaskList>())

  // ---- scope switching (sign in / sign out / account switch) ----
  useEffect(() => {
    if (authLoading) return
    const next = userId ?? LOCAL_SCOPE
    if (next === scope) return
    syncedTasks.current = new Map()
    syncedLists.current = new Map()
    // Signing out must not leave the account's tasks readable on the device.
    if (scope !== LOCAL_SCOPE) clearScope(scope)
    dispatch({
      type: 'SET_SCOPE',
      scope: next,
      tasks: loadTasks(next) ?? [],
      lists: loadLists(next) ?? [],
    })
  }, [authLoading, userId, scope])

  // ---- initial server read for the current scope ----
  useEffect(() => {
    if (authLoading || ready) return

    if (!userId) {
      // Signed out: seed the sample data once so the app is never a blank slate.
      if (state.tasks.length === 0 && state.lists.length === 0) {
        dispatch({ type: 'SEED', scope: LOCAL_SCOPE })
      }
      dispatch({ type: 'READY', scope: LOCAL_SCOPE })
      return
    }

    let cancelled = false
    void (async () => {
      const { tasks, lists, fromServer } = await loadFromServer(userId)
      if (cancelled) return
      if (fromServer) {
        for (const t of tasks) syncedTasks.current.set(t.id, t)
        for (const l of lists) syncedLists.current.set(l.id, l)
        dispatch({ type: 'MERGE_SERVER', scope: userId, tasks, lists })
        // A brand-new account with nothing cached locally gets the samples.
        if (!tasks.length && !lists.length && !state.tasks.length && !state.lists.length) {
          dispatch({ type: 'SEED', scope: userId })
        }
      }
      // On a failed read we stay offline-only: `ready` still flips so local
      // edits keep working, but nothing was marked as synced, so every row is
      // pushed once connectivity returns.
      dispatch({ type: 'READY', scope: userId })
    })()

    return () => {
      cancelled = true
    }
    // `state.tasks`/`state.lists` are read for the empty-account check only;
    // re-running on every edit would restart the load, so they stay out.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, userId, ready])

  // ---- realtime: subscribe once per account, tear down on account change ----
  useEffect(() => {
    if (!userId || !ready) return
    return subscribeToChanges(
      userId,
      (serverTasks) => {
        const removeTaskIds = reconcile(syncedTasks.current, serverTasks)
        dispatch({ type: 'MERGE_SERVER', scope: userId, tasks: serverTasks, lists: [], removeTaskIds })
      },
      (serverLists) => {
        const removeListIds = reconcile(syncedLists.current, serverLists)
        dispatch({ type: 'MERGE_SERVER', scope: userId, tasks: [], lists: serverLists, removeListIds })
      },
    )
  }, [userId, ready])

  // ---- local cache ----
  useEffect(() => saveTasks(scope, state.tasks), [scope, state.tasks])
  useEffect(() => saveLists(scope, state.lists), [scope, state.lists])

  // ---- push changed rows to the server (debounced) ----
  useEffect(() => {
    if (!userId || !ready) return
    const timer = setTimeout(() => {
      const liveTaskIds = new Set<string>()
      for (const t of state.tasks) {
        liveTaskIds.add(t.id)
        if (syncedTasks.current.get(t.id) === t) continue
        syncedTasks.current.set(t.id, t)
        upsertTask(t, userId).catch(() => syncedTasks.current.delete(t.id))
      }
      for (const id of [...syncedTasks.current.keys()]) {
        if (liveTaskIds.has(id)) continue
        syncedTasks.current.delete(id)
        deleteTaskRow(id).catch(() => {})
      }

      const liveListIds = new Set<string>()
      for (const l of state.lists) {
        liveListIds.add(l.id)
        if (syncedLists.current.get(l.id) === l) continue
        syncedLists.current.set(l.id, l)
        upsertList(l, userId).catch(() => syncedLists.current.delete(l.id))
      }
      for (const id of [...syncedLists.current.keys()]) {
        if (liveListIds.has(id)) continue
        syncedLists.current.delete(id)
        deleteListRow(id).catch(() => {})
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [state.tasks, state.lists, userId, ready])

  const addTask: TaskStore['addTask'] = useCallback((input) => {
    const stamp = new Date().toISOString()
    const task: Task = {
      id: makeId(),
      title: input.title.trim(),
      description: input.description?.trim() ?? '',
      completed: false,
      priority: input.priority ?? 'none',
      dueDate: input.dueDate ?? null,
      listId: input.listId ?? null,
      tags: input.tags ?? [],
      favorite: false,
      reminder: input.reminder ?? null,
      sortOrder: Date.now(),
      createdAt: stamp,
      completedAt: null,
      updatedAt: stamp,
      deletedAt: null,
    }
    dispatch({ type: 'ADD_TASK', task })
    return task
  }, [])

  const addList: TaskStore['addList'] = useCallback((name, color) => {
    const list: TaskList = {
      id: makeId(),
      name: name.trim(),
      color,
      createdAt: new Date().toISOString(),
    }
    dispatch({ type: 'ADD_LIST', list })
    return list
  }, [])

  const store = useMemo<TaskStore>(
    () => ({
      tasks: state.tasks,
      lists: state.lists,
      lastDeleted: state.lastDeleted,
      ready: state.ready,
      addTask,
      addList,
      updateTask: (id, patch) => dispatch({ type: 'UPDATE_TASK', id, patch }),
      deleteTask: (id) => dispatch({ type: 'DELETE_TASK', id }),
      undoDelete: () => dispatch({ type: 'UNDO_DELETE' }),
      restoreTask: (id) => dispatch({ type: 'RESTORE_FROM_TRASH', id }),
      permanentDelete: (id) => dispatch({ type: 'PERMANENT_DELETE', id }),
      emptyTrash: () => dispatch({ type: 'EMPTY_TRASH' }),
      clearUndo: () => dispatch({ type: 'CLEAR_UNDO' }),
      toggleComplete: (id) => dispatch({ type: 'TOGGLE_COMPLETE', id }),
      toggleFavorite: (id) => dispatch({ type: 'TOGGLE_FAVORITE', id }),
      duplicateTask: (id) => dispatch({ type: 'DUPLICATE_TASK', id }),
      clearCompleted: () => dispatch({ type: 'CLEAR_COMPLETED' }),
      deleteList: (id) => dispatch({ type: 'DELETE_LIST', id }),
      updateList: (id, patch) => dispatch({ type: 'UPDATE_LIST', id, patch }),
    }),
    [state, addTask, addList],
  )

  return <TaskContext.Provider value={store}>{children}</TaskContext.Provider>
}

export function useTaskStore(): TaskStore {
  const ctx = useContext(TaskContext)
  if (!ctx) throw new Error('useTaskStore must be used within TaskProvider')
  return ctx
}
