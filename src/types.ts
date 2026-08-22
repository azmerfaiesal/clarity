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
  | 'inbox'
  | 'today'
  | 'upcoming'
  | 'completed'
  | 'favorites'
  | 'trash'
  | `list:${string}`

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
