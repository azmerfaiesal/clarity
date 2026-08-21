import type { Filters, Priority, SortMode, Task, TaskList, ViewId } from '../types'
import { addDays, isOverdue, isToday, isWithinDays, todayStr } from './dateUtils'

export const PRIORITY_WEIGHT: Record<Priority, number> = {
  high: 3,
  medium: 2,
  low: 1,
  none: 0,
}

export const PRIORITY_LABEL: Record<Priority, string> = {
  none: 'None',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

export function tasksForView(tasks: Task[], view: ViewId): Task[] {
  const today = todayStr()
  if (view === 'trash') {
    return tasks
      .filter((t) => t.deletedAt !== null)
      .sort((a, b) => (b.deletedAt ?? '').localeCompare(a.deletedAt ?? ''))
  }
  // Every other view excludes trashed tasks
  const active = tasks.filter((t) => t.deletedAt === null)
  switch (view) {
    case 'inbox':
      return active.filter((t) => !t.completed)
    case 'today':
      return active.filter((t) => !t.completed && t.dueDate !== null && t.dueDate <= today)
    case 'upcoming':
      return active.filter((t) => !t.completed && t.dueDate !== null)
    case 'completed':
      return active.filter((t) => t.completed)
    case 'favorites':
      return active.filter((t) => t.favorite)
    default:
      if (view.startsWith('list:')) {
        const listId = view.slice(5)
        return active.filter((t) => !t.completed && t.listId === listId)
      }
      return active.filter((t) => !t.completed)
  }
}

export function applySearch(tasks: Task[], query: string, lists: TaskList[]): Task[] {
  const q = query.trim().toLowerCase()
  if (!q) return tasks
  const listName = (id: string | null) =>
    (lists.find((l) => l.id === id)?.name ?? 'inbox').toLowerCase()
  return tasks.filter((t) => {
    if (t.deletedAt !== null) return false // trashed tasks are not searchable
    return (
      t.title.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.tags.some((tag) => tag.toLowerCase().includes(q)) ||
      listName(t.listId).includes(q)
    )
  })
}

export function applyFilters(tasks: Task[], filters: Filters): Task[] {
  return tasks.filter((t) => {
    if (filters.status === 'active' && t.completed) return false
    if (filters.status === 'completed' && !t.completed) return false
    if (filters.priorities.length > 0 && !filters.priorities.includes(t.priority)) return false
    if (filters.favoriteOnly && !t.favorite) return false
    if (filters.listId !== 'any' && t.listId !== filters.listId) return false
    switch (filters.due) {
      case 'overdue':
        if (!isOverdue(t.dueDate) || t.completed) return false
        break
      case 'today':
        if (!isToday(t.dueDate)) return false
        break
      case 'week':
        if (!isWithinDays(t.dueDate, 7)) return false
        break
      case 'none':
        if (t.dueDate !== null) return false
        break
    }
    return true
  })
}

export function sortTasks(tasks: Task[], mode: SortMode): Task[] {
  const arr = [...tasks]
  switch (mode) {
    case 'manual':
      arr.sort((a, b) => a.sortOrder - b.sortOrder)
      break
    case 'dueDate':
      arr.sort((a, b) => {
        if (a.dueDate === null && b.dueDate === null) return a.sortOrder - b.sortOrder
        if (a.dueDate === null) return 1
        if (b.dueDate === null) return -1
        return a.dueDate.localeCompare(b.dueDate)
      })
      break
    case 'priority':
      arr.sort(
        (a, b) =>
          PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority] ||
          a.sortOrder - b.sortOrder,
      )
      break
    case 'created':
      arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      break
    case 'alpha':
      arr.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
      break
  }
  return arr
}

export function isFilterActive(f: Filters): boolean {
  return (
    f.status !== 'all' ||
    f.priorities.length > 0 ||
    f.due !== 'any' ||
    f.listId !== 'any' ||
    f.favoriteOnly
  )
}

export function countActiveFilters(f: Filters): number {
  let n = 0
  if (f.status !== 'all') n++
  if (f.priorities.length > 0) n++
  if (f.due !== 'any') n++
  if (f.listId !== 'any') n++
  if (f.favoriteOnly) n++
  return n
}

/** Group tasks by due date for the Upcoming view: overdue first, then chronologically. */
export function groupByDate(tasks: Task[]): { date: string; tasks: Task[] }[] {
  const sorted = [...tasks].sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
  const groups = new Map<string, Task[]>()
  for (const t of sorted) {
    const key = t.dueDate ?? addDays(todayStr(), 3650)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(t)
  }
  return [...groups.entries()].map(([date, tasks]) => ({ date, tasks }))
}

export function makeId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
