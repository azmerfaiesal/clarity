import type { BrainDump, Habit, HabitTemplate, Task, TaskList } from '../types'
import { addDays, todayStr } from '../utils/dateUtils'
import { makeId } from '../utils/taskUtils'
import type { NoteTemplateRow } from './noteTemplates'

/**
 * Local persistence layer.
 *
 * Caches are namespaced per *scope* — the signed-in user's id, or `local` for
 * the pre-auth session. Without this, signing out on a shared device would
 * leave one account's tasks visible to the next person to sign in.
 *
 * Everything here is intentionally dumb key/value work: swapping localStorage
 * for IndexedDB (or a different backend) only touches this file.
 */

export const LOCAL_SCOPE = 'local'

const PREFIX = 'clarity.v2'
const THEME_KEY = 'clarity.theme.v1'
const FONT_KEY = 'clarity.fontsize.v1'
const FONT_FAMILY_KEY = 'clarity.fontfamily.v1'
const WEEK_START_KEY = 'clarity.weekstart.v1'
const ACCENT_KEY = 'clarity.accent.v1'
const HABIT_RANGE_KEY = 'clarity.habitrange.v1'
const VIEW_KEY = 'clarity.view.v1'

const tasksKey = (scope: string) => `${PREFIX}.tasks:${scope}`
const listsKey = (scope: string) => `${PREFIX}.lists:${scope}`
const notesKey = (scope: string) => `${PREFIX}.notes:${scope}`
const habitsKey = (scope: string) => `${PREFIX}.habits:${scope}`
const templatesKey = (scope: string) => `${PREFIX}.habitTemplates:${scope}`
const noteTemplatesKey = (scope: string) => `${PREFIX}.noteTemplates:${scope}`
const draftKey = (scope: string) => `${PREFIX}.draft:${scope}`
const syncedKey = (scope: string, kind: SyncedKind) => `${PREFIX}.synced.${kind}:${scope}`

export type SyncedKind = 'tasks' | 'lists' | 'notes' | 'habits'

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage full / unavailable — the server copy is the source of truth */
  }
}

export function loadTasks(scope: string): Task[] | null {
  return read<Task[]>(tasksKey(scope))
}

export function saveTasks(scope: string, tasks: Task[]): void {
  write(tasksKey(scope), tasks)
}

export function loadLists(scope: string): TaskList[] | null {
  return read<TaskList[]>(listsKey(scope))
}

export function saveLists(scope: string, lists: TaskList[]): void {
  write(listsKey(scope), lists)
}

export function loadNotes(scope: string): BrainDump[] | null {
  return read<BrainDump[]>(notesKey(scope))
}

export function saveNotes(scope: string, notes: BrainDump[]): void {
  write(notesKey(scope), notes)
}

export function loadNoteTemplates(scope: string): NoteTemplateRow[] | null {
  return read<NoteTemplateRow[]>(noteTemplatesKey(scope))
}

export function saveNoteTemplates(scope: string, rows: NoteTemplateRow[]): void {
  write(noteTemplatesKey(scope), rows)
}

export function loadHabits(scope: string): Habit[] | null {
  return read<Habit[]>(habitsKey(scope))
}

export function saveHabits(scope: string, habits: Habit[]): void {
  write(habitsKey(scope), habits)
}

export function loadTemplates(scope: string): HabitTemplate[] | null {
  return read<HabitTemplate[]>(templatesKey(scope))
}

export function saveTemplates(scope: string, templates: HabitTemplate[]): void {
  write(templatesKey(scope), templates)
}

/**
 * The unsaved Brain Dump composer text, kept so a refresh mid-thought does not
 * throw away what was typed. Cleared once the note is saved or discarded.
 */
export function loadDraft(scope: string): { content: string; tags: string[] } | null {
  return read<{ content: string; tags: string[] }>(draftKey(scope))
}

export function saveDraft(scope: string, draft: { content: string; tags: string[] }): void {
  write(draftKey(scope), draft)
}

export function clearDraft(scope: string): void {
  try {
    localStorage.removeItem(draftKey(scope))
  } catch {
    /* ignore */
  }
}

/** Drop a scope's cache entirely (used on sign-out). */
export function clearScope(scope: string): void {
  try {
    localStorage.removeItem(tasksKey(scope))
    localStorage.removeItem(listsKey(scope))
    localStorage.removeItem(notesKey(scope))
    localStorage.removeItem(habitsKey(scope))
    localStorage.removeItem(templatesKey(scope))
    localStorage.removeItem(noteTemplatesKey(scope))
    localStorage.removeItem(draftKey(scope))
    for (const kind of ['tasks', 'lists', 'notes', 'habits'] as SyncedKind[]) {
      localStorage.removeItem(syncedKey(scope, kind))
    }
  } catch {
    /* ignore */
  }
}

/**
 * Ids the cache believes the server already had when it was last written.
 *
 * This is what separates "created here while offline, hold on to it" from
 * "deleted on another device while this one was closed, let it go". Both look
 * identical in the cache alone — a row present locally and absent from the
 * server — and without the distinction a device resurrects everything it ever
 * lost track of, which is how two devices end up disagreeing about how many
 * habits there are.
 */
export function loadSyncedIds(scope: string, kind: SyncedKind): string[] | null {
  return read<string[]>(syncedKey(scope, kind))
}

export function saveSyncedIds(scope: string, kind: SyncedKind, ids: string[]): void {
  write(syncedKey(scope, kind), ids)
}

export function loadTheme(): 'light' | 'dark' | null {
  try {
    const v = localStorage.getItem(THEME_KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

export function saveTheme(theme: 'light' | 'dark'): void {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    /* ignore */
  }
}

/** Text-size preference. Kept as a token, not a number, so the scale can be retuned. */
export function loadFontScale(): 'sm' | 'md' | 'lg' | 'xl' | null {
  try {
    const v = localStorage.getItem(FONT_KEY)
    return v === 'sm' || v === 'md' || v === 'lg' || v === 'xl' ? v : null
  } catch {
    return null
  }
}

export function saveFontScale(size: 'sm' | 'md' | 'lg' | 'xl'): void {
  try {
    localStorage.setItem(FONT_KEY, size)
  } catch {
    /* ignore */
  }
}

/** UI typeface preference. Validated by the caller against the font registry. */
export function loadFontFamily(): string | null {
  try {
    return localStorage.getItem(FONT_FAMILY_KEY)
  } catch {
    return null
  }
}

export function saveFontFamily(key: string): void {
  try {
    localStorage.setItem(FONT_FAMILY_KEY, key)
  } catch {
    /* ignore */
  }
}

/** First day of the week, 0 = Sunday and 1 = Monday. Null when never chosen. */
export function loadWeekStart(): number | null {
  try {
    const raw = localStorage.getItem(WEEK_START_KEY)
    return raw === '0' || raw === '1' ? Number(raw) : null
  } catch {
    return null
  }
}

export function saveWeekStart(day: number): void {
  try {
    localStorage.setItem(WEEK_START_KEY, String(day))
  } catch {
    /* ignore */
  }
}

/** Accent colour preference. Validated by the caller against the registry. */
export function loadAccent(): string | null {
  try {
    return localStorage.getItem(ACCENT_KEY)
  } catch {
    return null
  }
}

export function saveAccent(key: string): void {
  try {
    localStorage.setItem(ACCENT_KEY, key)
  } catch {
    /* ignore */
  }
}

/**
 * The section that was open, so a refresh puts you back where you were rather
 * than at Home. Device-local and not scoped to an account: it is a position in
 * the app, not data. A view naming a list that no longer exists is caught by
 * the fallback in App.
 */
export function loadView(): string | null {
  try {
    return localStorage.getItem(VIEW_KEY)
  } catch {
    return null
  }
}

export function saveView(view: string): void {
  try {
    localStorage.setItem(VIEW_KEY, view)
  } catch {
    /* ignore */
  }
}

/**
 * Which span each habit card was last showing, keyed by habit id.
 *
 * Device-local like the other view preferences: the range you want on a phone
 * is not always the one you want on a laptop, and it describes how you are
 * looking at a habit rather than anything about the habit itself.
 */
export function loadHabitRange(habitId: string): string | null {
  try {
    const raw = localStorage.getItem(HABIT_RANGE_KEY)
    if (!raw) return null
    const map = JSON.parse(raw) as Record<string, string>
    return map[habitId] ?? null
  } catch {
    return null
  }
}

export function saveHabitRange(habitId: string, range: string): void {
  try {
    const raw = localStorage.getItem(HABIT_RANGE_KEY)
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {}
    map[habitId] = range
    localStorage.setItem(HABIT_RANGE_KEY, JSON.stringify(map))
  } catch {
    /* storage full or unavailable — the card just opens on its default */
  }
}

export function seedLists(): TaskList[] {
  const now = new Date().toISOString()
  return [
    { id: 'list-personal', name: 'Personal', color: '#3ddbf0', createdAt: now },
    { id: 'list-work', name: 'Work', color: '#3bff9e', createdAt: now },
    { id: 'list-shopping', name: 'Shopping', color: '#ffb020', createdAt: now },
    { id: 'list-projects', name: 'Projects', color: '#ff4d5e', createdAt: now },
  ]
}

export function seedTasks(): Task[] {
  const now = Date.now()
  const iso = (offsetMin: number) => new Date(now - offsetMin * 60_000).toISOString()
  const today = todayStr()

  const base = {
    description: '',
    reminder: null,
    completedAt: null,
    updatedAt: iso(0),
    deletedAt: null,
    favorite: false,
    tags: [] as string[],
  }

  const tasks: Task[] = [
    {
      ...base,
      id: makeId(),
      title: 'Review PostgreSQL monitoring dashboard',
      description: 'Check query latency and connection pool metrics before the standup.',
      completed: false,
      priority: 'high',
      dueDate: today,
      listId: 'list-work',
      tags: ['devops'],
      sortOrder: 1,
      createdAt: iso(60 * 26),
    },
    {
      ...base,
      id: makeId(),
      title: 'Finish weekly report',
      description: 'Summarize sprint progress and blockers.',
      completed: false,
      priority: 'medium',
      dueDate: today,
      listId: 'list-work',
      sortOrder: 2,
      createdAt: iso(60 * 20),
    },
    {
      ...base,
      id: makeId(),
      title: 'Buy groceries',
      description: 'Eggs, spinach, sourdough, oat milk, coffee beans.',
      completed: false,
      priority: 'none',
      dueDate: today,
      listId: 'list-shopping',
      sortOrder: 3,
      createdAt: iso(60 * 12),
      favorite: true,
    },
    {
      ...base,
      id: makeId(),
      title: 'Review project documentation',
      description: 'Read through the architecture RFC and leave comments.',
      completed: false,
      priority: 'low',
      dueDate: addDays(today, 1),
      listId: 'list-projects',
      tags: ['reading'],
      sortOrder: 4,
      createdAt: iso(60 * 8),
    },
    {
      ...base,
      id: makeId(),
      title: 'Read 20 pages',
      description: 'Continue "The Design of Everyday Things".',
      completed: false,
      priority: 'none',
      dueDate: null,
      listId: 'list-personal',
      tags: ['reading', 'habit'],
      sortOrder: 5,
      createdAt: iso(60 * 5),
    },
    {
      ...base,
      id: makeId(),
      title: 'Plan weekend activities',
      description: 'Look into the farmers market and the new hiking trail.',
      completed: false,
      priority: 'low',
      dueDate: addDays(today, 3),
      listId: 'list-personal',
      sortOrder: 6,
      createdAt: iso(60 * 3),
      favorite: true,
    },
    {
      ...base,
      id: makeId(),
      title: 'Renew gym membership',
      completed: false,
      priority: 'medium',
      dueDate: addDays(today, 6),
      listId: 'list-personal',
      sortOrder: 7,
      createdAt: iso(60 * 2),
    },
    {
      ...base,
      id: makeId(),
      title: 'Prepare design review slides',
      description: 'For the Thursday product sync.',
      completed: false,
      priority: 'high',
      dueDate: addDays(today, 2),
      listId: 'list-work',
      sortOrder: 8,
      createdAt: iso(60),
    },
    {
      ...base,
      id: makeId(),
      title: 'Water the plants',
      completed: true,
      priority: 'none',
      dueDate: today,
      listId: 'list-personal',
      sortOrder: 9,
      createdAt: iso(60 * 30),
      completedAt: iso(60 * 4),
    },
    {
      ...base,
      id: makeId(),
      title: 'Submit expense report',
      completed: true,
      priority: 'medium',
      dueDate: addDays(today, -1),
      listId: 'list-work',
      sortOrder: 10,
      createdAt: iso(60 * 50),
      completedAt: iso(60 * 28),
    },
  ]
  return tasks
}
