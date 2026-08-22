import type { Task, TaskList } from '../types'
import { supabase } from '../lib/supabase'

/**
 * Sync layer between the local reducer state and Supabase.
 *
 * Strategy: last-write-wins keyed on `updatedAt`. Local storage remains the
 * offline cache. On load we pull the server rows; on every local mutation we
 * upsert the affected rows. Realtime keeps other devices in sync.
 */

const TASKS_TABLE = 'clarity_tasks'
const LISTS_TABLE = 'clarity_lists'

export interface LoadedData {
  tasks: Task[]
  lists: TaskList[]
  /** true when we successfully read from the server (vs. falling back to local) */
  fromServer: boolean
}

export async function loadFromServer(userId: string): Promise<LoadedData> {
  const [{ data: tasks, error: te }, { data: lists, error: le }] = await Promise.all([
    supabase.from(TASKS_TABLE).select('*').eq('user_id', userId),
    supabase.from(LISTS_TABLE).select('*').eq('user_id', userId),
  ])

  if (te || le) {
    return { tasks: [], lists: [], fromServer: false }
  }

  return {
    tasks: (tasks ?? []).map(rowToTask),
    lists: (lists ?? []).map(rowToList),
    fromServer: true,
  }
}

export async function upsertTask(task: Task, userId: string): Promise<void> {
  await supabase.from(TASKS_TABLE).upsert(taskToRow(task, userId), {
    onConflict: 'id',
  })
}

export async function deleteTaskRow(id: string): Promise<void> {
  await supabase.from(TASKS_TABLE).delete().eq('id', id)
}

export async function upsertList(list: TaskList, userId: string): Promise<void> {
  await supabase.from(LISTS_TABLE).upsert(listToRow(list, userId), {
    onConflict: 'id',
  })
}

export async function deleteListRow(id: string): Promise<void> {
  await supabase.from(LISTS_TABLE).delete().eq('id', id)
}

// ---- row <-> model mapping ----

function rowToTask(r: Record<string, unknown>): Task {
  return {
    id: String(r.id),
    title: String(r.title ?? ''),
    description: String(r.description ?? ''),
    completed: Boolean(r.completed),
    priority: (r.priority as Task['priority']) ?? 'none',
    dueDate: (r.due_date as string | null) ?? null,
    listId: (r.list_id as string | null) ?? null,
    tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
    favorite: Boolean(r.favorite),
    reminder: (r.reminder as string | null) ?? null,
    sortOrder: Number(r.sort_order ?? 0),
    createdAt: String(r.created_at ?? new Date().toISOString()),
    completedAt: (r.completed_at as string | null) ?? null,
    updatedAt: String(r.updated_at ?? new Date().toISOString()),
    deletedAt: (r.deleted_at as string | null) ?? null,
  }
}

function taskToRow(t: Task, userId: string) {
  return {
    id: t.id,
    user_id: userId,
    title: t.title,
    description: t.description,
    completed: t.completed,
    priority: t.priority,
    due_date: t.dueDate,
    list_id: t.listId,
    tags: t.tags,
    favorite: t.favorite,
    reminder: t.reminder,
    sort_order: t.sortOrder,
    created_at: t.createdAt,
    completed_at: t.completedAt,
    updated_at: t.updatedAt,
    deleted_at: t.deletedAt,
  }
}

function rowToList(r: Record<string, unknown>): TaskList {
  return {
    id: String(r.id),
    name: String(r.name ?? ''),
    color: String(r.color ?? '#3ddbf0'),
    createdAt: String(r.created_at ?? new Date().toISOString()),
  }
}

function listToRow(l: TaskList, userId: string) {
  return {
    id: l.id,
    user_id: userId,
    name: l.name,
    color: l.color,
    created_at: l.createdAt,
  }
}

// ---- realtime ----

export function subscribeToChanges(
  userId: string,
  onTasks: (tasks: Task[]) => void,
  onLists: (lists: TaskList[]) => void,
) {
  const tasksCh = supabase
    .channel(`clarity-tasks-${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TASKS_TABLE, filter: `user_id=eq.${userId}` },
      async () => {
        const { data } = await supabase.from(TASKS_TABLE).select('*').eq('user_id', userId)
        if (data) onTasks(data.map(rowToTask))
      },
    )
    .subscribe()

  const listsCh = supabase
    .channel(`clarity-lists-${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: LISTS_TABLE, filter: `user_id=eq.${userId}` },
      async () => {
        const { data } = await supabase.from(LISTS_TABLE).select('*').eq('user_id', userId)
        if (data) onLists(data.map(rowToList))
      },
    )
    .subscribe()

  return () => {
    supabase.removeChannel(tasksCh)
    supabase.removeChannel(listsCh)
  }
}
