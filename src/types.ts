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

export type RepetitionType = 'daily' | 'weekly' | 'monthly' | 'timesPerWeek'
export type TrackBy = 'checkoff' | 'count' | 'duration'
/** Where completions come from. `notes` habits tick themselves when you write. */
export type HabitSource = 'manual' | 'notes'

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
  /** Completions needed per week when repetitionType is 'timesPerWeek'. */
  timesPerWeek: number | null
  /** Checkoff is a tick; count logs a number; duration logs minutes. */
  trackBy: TrackBy
  /** Amount that finishes a day — logs for count, minutes for duration. */
  dailyTarget: number | null
  color: string
  /** A `lucide:name` reference, a raw emoji, or empty. */
  icon: string
  targetStreak: number | null
  createdAt: string
  /**
   * Completion log, local 'YYYY-MM-DD' to amount. Checkoff stores 1, count
   * stores the number of logs, duration stores minutes — one shape for all
   * three, so the streak maths never branches on how a habit is tracked.
   */
  logs: Record<string, number>
  lastCompleted: string | null
  /** Set to pause a habit without destroying its history. */
  archivedAt: string | null
  /** Manual ordering, lowest first. */
  sortOrder: number
  source: HabitSource
}

/** A saved habit shape, reusable when creating a new one. */
export interface HabitTemplate {
  id: string
  name: string
  description: string
  icon: string
  color: string
  repetitionType: RepetitionType
  daysOfWeek: number[]
  datesOfMonth: number[]
  timesPerWeek: number | null
  trackBy: TrackBy
  dailyTarget: number | null
  createdAt: string
}

/** Sidebar filter for the habit list. */
export type HabitFilter = 'all' | 'daily' | 'weekly' | 'monthly'

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
