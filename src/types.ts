export type Priority = 'none' | 'low' | 'medium' | 'high'

export interface Task {
  id: string
  title: string
  description: string
  completed: boolean
  priority: Priority
  dueDate: string | null // ISO date string (yyyy-mm-dd)
  listId: string | null // null = inbox
  tags: string[]
  favorite: boolean
  reminder: string | null // ISO datetime
  sortOrder: number
  createdAt: string
  completedAt: string | null
  updatedAt: string
  deletedAt: string | null // set when moved to the recycle bin
}

export interface TaskList {
  id: string
  name: string
  color: string
  createdAt: string
}

export type ViewId =
  | 'home'
  | 'inbox'
  | 'today'
  | 'upcoming'
  | 'completed'
  | 'favorites'
  | 'trash'
  | 'notes'
  | 'habits'
  | `list:${string}`

/** A Brain Dump note: free-form text, optional tags, nothing required but the body. */
export interface BrainDump {
  id: string
  content: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export type RepetitionType = 'daily' | 'weekly' | 'monthly'

/**
 * A habit. `completedDates` (local 'YYYY-MM-DD') is the source of truth for all
 * tracking; streak, best streak, totals and completion rate are derived from it
 * on read rather than stored, so they cannot drift away from the log after an
 * edit or an undo. `lastCompleted` is kept separately because it carries a
 * time of day the date log cannot.
 */
export interface Habit {
  id: string
  name: string
  description: string
  repetitionType: RepetitionType
  /** 0=Sunday … 6=Saturday. Used when repetitionType is 'weekly'. */
  daysOfWeek: number[]
  /** 1–31. Used when repetitionType is 'monthly'. */
  datesOfMonth: number[]
  color: string
  icon: string
  targetStreak: number | null
  /** When true the habit can be logged several times a day. */
  allowRepeats: boolean
  /** Logs needed for a day to count as done. Null means one. */
  dailyTarget: number | null
  createdAt: string
  /**
   * A multiset of local 'YYYY-MM-DD' completion events — the same date repeated
   * means it was logged that many times. A binary habit is simply the case
   * where no date repeats, so old data needs no migration.
   */
  completedDates: string[]
  lastCompleted: string | null
  /** Set to pause a habit without destroying its history. */
  archivedAt: string | null
}

export type SortMode = 'manual' | 'dueDate' | 'priority' | 'created' | 'alpha'

export interface Filters {
  status: 'all' | 'active' | 'completed'
  priorities: Priority[]
  due: 'any' | 'overdue' | 'today' | 'week' | 'none'
  listId: string | 'any'
  favoriteOnly: boolean
}

export const DEFAULT_FILTERS: Filters = {
  status: 'all',
  priorities: [],
  due: 'any',
  listId: 'any',
  favoriteOnly: false,
}
