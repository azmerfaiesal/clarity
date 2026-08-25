import type { BrainDump, Habit, HabitTemplate, Task, TaskList } from '../types'
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
const NOTES_TABLE = 'clarity_notes'
const HABITS_TABLE = 'clarity_habits'
const TEMPLATES_TABLE = 'clarity_habit_templates'

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

// ---- habits ----

export async function loadHabitsFromServer(
  userId: string,
): Promise<{ habits: Habit[]; fromServer: boolean }> {
  const { data, error } = await supabase
    .from(HABITS_TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) return { habits: [], fromServer: false }
  return { habits: (data ?? []).map(rowToHabit), fromServer: true }
}

export async function upsertHabit(habit: Habit, userId: string): Promise<void> {
  const { error } = await supabase
    .from(HABITS_TABLE)
    .upsert(habitToRow(habit, userId), { onConflict: 'id' })
  if (error) throw error
}

export async function deleteHabitRow(id: string): Promise<void> {
  const { error } = await supabase.from(HABITS_TABLE).delete().eq('id', id)
  if (error) throw error
}

export function subscribeToHabits(userId: string, onHabits: (habits: Habit[]) => void) {
  const channel = supabase
    .channel(`clarity-habits-${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: HABITS_TABLE, filter: `user_id=eq.${userId}` },
      async () => {
        const { data } = await supabase
          .from(HABITS_TABLE)
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: true })
        if (data) onHabits(data.map(rowToHabit))
      },
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

function numberArray(v: unknown): number[] {
  return Array.isArray(v) ? v.filter((n): n is number => typeof n === 'number') : []
}

function rowToHabit(r: Record<string, unknown>): Habit {
  const logs: Record<string, number> = {}
  if (r.logs && typeof r.logs === 'object') {
    for (const [k, v] of Object.entries(r.logs as Record<string, unknown>)) {
      if (typeof v === 'number' && v > 0) logs[k] = v
    }
  }
  const logNotes: Record<string, string[]> = {}
  if (r.log_notes && typeof r.log_notes === 'object') {
    for (const [k, v] of Object.entries(r.log_notes as Record<string, unknown>)) {
      if (Array.isArray(v)) logNotes[k] = v.filter((n): n is string => typeof n === 'string')
    }
  }
  return {
    id: String(r.id),
    name: String(r.name ?? ''),
    description: String(r.description ?? ''),
    repetitionType: (r.repetition_type as Habit['repetitionType']) ?? 'daily',
    daysOfWeek: numberArray(r.days_of_week),
    datesOfMonth: numberArray(r.dates_of_month),
    timesPerWeek: typeof r.times_per_week === 'number' ? r.times_per_week : null,
    trackBy: (r.track_by as Habit['trackBy']) ?? 'checkoff',
    dailyTarget: typeof r.daily_target === 'number' ? r.daily_target : null,
    color: String(r.color ?? '#3ddbf0'),
    icon: String(r.icon ?? ''),
    targetStreak: typeof r.target_streak === 'number' ? r.target_streak : null,
    reminderTime: (r.reminder_time as string | null) ?? null,
    createdAt: String(r.created_at ?? new Date().toISOString()),
    logs,
    logNotes,
    lastCompleted: (r.last_completed as string | null) ?? null,
    archivedAt: (r.archived_at as string | null) ?? null,
    sortOrder: typeof r.sort_order === 'number' ? r.sort_order : 0,
    source: (r.source as Habit['source']) ?? 'manual',
  }
}

function habitToRow(h: Habit, userId: string) {
  return {
    id: h.id,
    user_id: userId,
    name: h.name,
    description: h.description,
    repetition_type: h.repetitionType,
    days_of_week: h.daysOfWeek,
    dates_of_month: h.datesOfMonth,
    times_per_week: h.timesPerWeek,
    track_by: h.trackBy,
    daily_target: h.dailyTarget,
    color: h.color,
    icon: h.icon,
    target_streak: h.targetStreak,
    reminder_time: h.reminderTime,
    logs: h.logs,
    log_notes: h.logNotes,
    last_completed: h.lastCompleted,
    archived_at: h.archivedAt,
    sort_order: h.sortOrder,
    source: h.source,
    created_at: h.createdAt,
    updated_at: new Date().toISOString(),
  }
}

// ---- habit templates ----

export async function loadTemplatesFromServer(
  userId: string,
): Promise<{ templates: HabitTemplate[]; fromServer: boolean }> {
  const { data, error } = await supabase
    .from(TEMPLATES_TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) return { templates: [], fromServer: false }
  return { templates: (data ?? []).map(rowToTemplate), fromServer: true }
}

export async function upsertTemplate(t: HabitTemplate, userId: string): Promise<void> {
  const { error } = await supabase
    .from(TEMPLATES_TABLE)
    .upsert(
      {
        id: t.id,
        user_id: userId,
        name: t.name,
        description: t.description,
        icon: t.icon,
        color: t.color,
        repetition_type: t.repetitionType,
        days_of_week: t.daysOfWeek,
        dates_of_month: t.datesOfMonth,
        times_per_week: t.timesPerWeek,
        track_by: t.trackBy,
        daily_target: t.dailyTarget,
        created_at: t.createdAt,
      },
      { onConflict: 'id' },
    )
  if (error) throw error
}

export async function deleteTemplateRow(id: string): Promise<void> {
  const { error } = await supabase.from(TEMPLATES_TABLE).delete().eq('id', id)
  if (error) throw error
}

function rowToTemplate(r: Record<string, unknown>): HabitTemplate {
  return {
    id: String(r.id),
    name: String(r.name ?? ''),
    description: String(r.description ?? ''),
    icon: String(r.icon ?? ''),
    color: String(r.color ?? '#3ddbf0'),
    repetitionType: (r.repetition_type as HabitTemplate['repetitionType']) ?? 'daily',
    daysOfWeek: numberArray(r.days_of_week),
    datesOfMonth: numberArray(r.dates_of_month),
    timesPerWeek: typeof r.times_per_week === 'number' ? r.times_per_week : null,
    trackBy: (r.track_by as HabitTemplate['trackBy']) ?? 'checkoff',
    dailyTarget: typeof r.daily_target === 'number' ? r.daily_target : null,
    createdAt: String(r.created_at ?? new Date().toISOString()),
  }
}

// ---- brain dump notes ----

export async function loadNotesFromServer(
  userId: string,
): Promise<{ notes: BrainDump[]; fromServer: boolean }> {
  const { data, error } = await supabase
    .from(NOTES_TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) return { notes: [], fromServer: false }
  return { notes: (data ?? []).map(rowToNote), fromServer: true }
}

export async function upsertNote(note: BrainDump, userId: string): Promise<void> {
  const { error } = await supabase
    .from(NOTES_TABLE)
    .upsert(noteToRow(note, userId), { onConflict: 'id' })
  if (error) throw error
}

export async function deleteNoteRow(id: string): Promise<void> {
  const { error } = await supabase.from(NOTES_TABLE).delete().eq('id', id)
  if (error) throw error
}

export function subscribeToNotes(userId: string, onNotes: (notes: BrainDump[]) => void) {
  const channel = supabase
    .channel(`clarity-notes-${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: NOTES_TABLE, filter: `user_id=eq.${userId}` },
      async () => {
        const { data } = await supabase
          .from(NOTES_TABLE)
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
        if (data) onNotes(data.map(rowToNote))
      },
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

function rowToNote(r: Record<string, unknown>): BrainDump {
  return {
    id: String(r.id),
    content: String(r.content ?? ''),
    tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
    createdAt: String(r.created_at ?? new Date().toISOString()),
    updatedAt: String(r.updated_at ?? new Date().toISOString()),
  }
}

function noteToRow(n: BrainDump, userId: string) {
  return {
    id: n.id,
    user_id: userId,
    content: n.content,
    tags: n.tags,
    created_at: n.createdAt,
    updated_at: n.updatedAt,
  }
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
