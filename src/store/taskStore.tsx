import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Priority, Task, TaskList } from '../types'
import { makeId } from '../utils/taskUtils'
import {
  isSeeded,
  loadLists,
  loadTasks,
  markSeeded,
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

interface State {
  tasks: Task[]
  lists: TaskList[]
  lastDeleted: { task: Task; index: number } | null
}

type Action =
  | { type: 'ADD_TASK'; task: Task }
  | { type: 'UPDATE_TASK'; id: string; patch: Partial<Task> }
  | { type: 'DELETE_TASK'; id: string }
  | { type: 'RESTORE_TASK' }
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
  | { type: 'RENAME_LIST'; id: string; name: string }
  | { type: 'REPLACE_ALL'; tasks: Task[]; lists: TaskList[] }
  | { type: 'REPLACE_TASKS'; tasks: Task[] }
  | { type: 'REPLACE_LISTS'; lists: TaskList[] }

function reducer(state: State, action: Action): State {
  const now = () => new Date().toISOString()
  const userId = (action as { userId?: string | null }).userId
  switch (action.type) {
    case 'ADD_TASK':
      return { ...state, tasks: [...state.tasks, action.task] }

    case 'UPDATE_TASK':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.id ? { ...t, ...action.patch, updatedAt: now() } : t,
        ),
      }

    case 'DELETE_TASK': {
      const index = state.tasks.findIndex((t) => t.id === action.id)
      if (index === -1) return state
      const task = state.tasks[index]
      return {
        ...state,
        // Soft delete: move to the recycle bin instead of removing
        tasks: state.tasks.map((t) =>
          t.id === action.id ? { ...t, deletedAt: now(), updatedAt: now() } : t,
        ),
        lastDeleted: { task, index },
      }
    }

    case 'RESTORE_TASK': {
      if (!state.lastDeleted) return state
      const { task } = state.lastDeleted
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === task.id ? { ...t, deletedAt: null, updatedAt: now() } : t,
        ),
        lastDeleted: null,
      }
    }

    case 'RESTORE_FROM_TRASH':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.id ? { ...t, deletedAt: null, updatedAt: now() } : t,
        ),
      }

    case 'PERMANENT_DELETE': {
      const leaving = state.tasks.find((t) => t.id === action.id)
      if (leaving && userId) deleteTaskRow(action.id).catch(() => {})
      return {
        ...state,
        tasks: state.tasks.filter((t) => t.id !== action.id),
      }
    }

    case 'EMPTY_TRASH': {
      const trashed = state.tasks.filter((t) => t.deletedAt !== null)
      if (userId) trashed.forEach((t) => deleteTaskRow(t.id).catch(() => {}))
      return {
        ...state,
        tasks: state.tasks.filter((t) => t.deletedAt === null),
      }
    }

    case 'CLEAR_UNDO':
      return state.lastDeleted ? { ...state, lastDeleted: null } : state

    case 'TOGGLE_COMPLETE':
      return {
        ...state,
        tasks: state.tasks.map((t) => {
          if (t.id !== action.id) return t
          const completed = !t.completed
          return {
            ...t,
            completed,
            completedAt: completed ? now() : null,
            updatedAt: now(),
          }
        }),
      }

    case 'TOGGLE_FAVORITE':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.id ? { ...t, favorite: !t.favorite, updatedAt: now() } : t,
        ),
      }

    case 'DUPLICATE_TASK': {
      const source = state.tasks.find((t) => t.id === action.id)
      if (!source) return state
      const maxOrder = Math.max(0, ...state.tasks.map((t) => t.sortOrder))
      const copy: Task = {
        ...source,
        id: makeId(),
        title: `${source.title} (copy)`,
        completed: false,
        completedAt: null,
        sortOrder: maxOrder + 1,
        createdAt: now(),
        updatedAt: now(),
      }
      return { ...state, tasks: [...state.tasks, copy] }
    }

    case 'CLEAR_COMPLETED':
      return { ...state, tasks: state.tasks.filter((t) => !t.completed) }

    case 'ADD_LIST':
      return { ...state, lists: [...state.lists, action.list] }

    case 'DELETE_LIST': {
      if (userId) deleteListRow(action.id).catch(() => {})
      return {
        ...state,
        lists: state.lists.filter((l) => l.id !== action.id),
        // Orphaned tasks fall back to Inbox
        tasks: state.tasks.map((t) =>
          t.listId === action.id ? { ...t, listId: null, updatedAt: now() } : t,
        ),
      }
    }

    case 'RENAME_LIST':
      return {
        ...state,
        lists: state.lists.map((l) =>
          l.id === action.id ? { ...l, name: action.name } : l,
        ),
      }

    case 'REPLACE_ALL':
      return { ...state, tasks: action.tasks, lists: action.lists, lastDeleted: null }

    case 'REPLACE_TASKS': {
      // Merge server tasks with any local-only rows (not yet pushed), server wins on conflict.
      const localOnly = state.tasks.filter(
        (t) => !action.tasks.some((s) => s.id === t.id),
      )
      return { ...state, tasks: [...action.tasks, ...localOnly] }
    }

    case 'REPLACE_LISTS': {
      const localOnly = state.lists.filter(
        (l) => !action.lists.some((s) => s.id === l.id),
      )
      return { ...state, lists: [...action.lists, ...localOnly] }
    }

    default:
      return state
  }
}

function initState(): State {
  const tasks = loadTasks()
  const lists = loadLists()
  if (tasks !== null && lists !== null) {
    // Migrate older records that predate the recycle bin
    const migrated = tasks.map((t) => ({
      ...t,
      deletedAt: (t.deletedAt ?? null) as string | null,
    }))
    return { tasks: migrated, lists, lastDeleted: null }
  }
  if (!isSeeded()) markSeeded()
  return { tasks: seedTasks(), lists: seedLists(), lastDeleted: null }
}

export interface TaskStore {
  tasks: Task[]
  lists: TaskList[]
  lastDeleted: State['lastDeleted']
  syncing: boolean
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
  renameList: (id: string, name: string) => void
}

const TaskContext = createContext<TaskStore | null>(null)

export function TaskProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id
  const [state, rawDispatch] = useReducer(reducer, undefined, initState)
  const dispatch = useCallback(
    (action: Action) => rawDispatch({ ...action, userId } as unknown as Action),
    [userId],
  )
  const [syncing, setSyncing] = useState(false)

  // Local persistence (offline cache / pre-auth)
  useEffect(() => saveTasks(state.tasks), [state.tasks])
  useEffect(() => saveLists(state.lists), [state.lists])

  // When the user signs in, pull their server data (once) and subscribe to realtime.
  const didLoad = useRef(false)
  useEffect(() => {
    if (!userId) return
    if (didLoad.current) return
    didLoad.current = true
    let unsub: (() => void) | undefined
    ;(async () => {
      setSyncing(true)
      const { tasks, lists, fromServer } = await loadFromServer(userId)
      if (fromServer && (tasks.length || lists.length)) {
        // Merge: server wins for existing ids, keep local-only rows too.
        dispatch({ type: 'REPLACE_ALL', tasks, lists })
      } else {
        // Fresh account: push the seeded sample data up so it's synced.
        const seedTasksToPush = tasks.length ? [] : state.tasks
        const seedListsToPush = lists.length ? [] : state.lists
        for (const t of seedTasksToPush) await upsertTask(t, userId)
        for (const l of seedListsToPush) await upsertList(l, userId)
      }
      unsub = subscribeToChanges(
        userId,
        (serverTasks) => dispatch({ type: 'REPLACE_TASKS', tasks: serverTasks }),
        (serverLists) => dispatch({ type: 'REPLACE_LISTS', lists: serverLists }),
      )
      setSyncing(false)
    })()
    return () => unsub?.()
  }, [userId, state.tasks, state.lists])

  // Debounced sync of local mutations to the server.
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!userId) return
    if (syncTimer.current) clearTimeout(syncTimer.current)
    syncTimer.current = setTimeout(() => {
      for (const t of state.tasks) upsertTask(t, userId).catch(() => {})
      for (const l of state.lists) upsertList(l, userId).catch(() => {})
    }, 400)
    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current)
    }
  }, [state.tasks, state.lists, userId])

  const addTask: TaskStore['addTask'] = useCallback((input) => {
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
      createdAt: new Date().toISOString(),
      completedAt: null,
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    }
    dispatch({ type: 'ADD_TASK', task })
    return task
  }, [])

  const store = useMemo<TaskStore>(
    () => ({
      tasks: state.tasks,
      lists: state.lists,
      lastDeleted: state.lastDeleted,
      syncing,
      addTask,
      updateTask: (id, patch) => dispatch({ type: 'UPDATE_TASK', id, patch }),
      deleteTask: (id) => dispatch({ type: 'DELETE_TASK', id }),
      undoDelete: () => dispatch({ type: 'RESTORE_TASK' }),
      restoreTask: (id) => dispatch({ type: 'RESTORE_FROM_TRASH', id }),
      permanentDelete: (id) => dispatch({ type: 'PERMANENT_DELETE', id }),
      emptyTrash: () => dispatch({ type: 'EMPTY_TRASH' }),
      clearUndo: () => dispatch({ type: 'CLEAR_UNDO' }),
      toggleComplete: (id) => dispatch({ type: 'TOGGLE_COMPLETE', id }),
      toggleFavorite: (id) => dispatch({ type: 'TOGGLE_FAVORITE', id }),
      duplicateTask: (id) => dispatch({ type: 'DUPLICATE_TASK', id }),
      clearCompleted: () => dispatch({ type: 'CLEAR_COMPLETED' }),
      addList: (name, color) => {
        const list: TaskList = {
          id: makeId(),
          name: name.trim(),
          color,
          createdAt: new Date().toISOString(),
        }
        dispatch({ type: 'ADD_LIST', list })
        return list
      },
      deleteList: (id) => dispatch({ type: 'DELETE_LIST', id }),
      renameList: (id, name) => dispatch({ type: 'RENAME_LIST', id, name }),
    }),
    [state, addTask],
  )

  return <TaskContext.Provider value={store}>{children}</TaskContext.Provider>
}

export function useTaskStore(): TaskStore {
  const ctx = useContext(TaskContext)
  if (!ctx) throw new Error('useTaskStore must be used within TaskProvider')
  return ctx
}
