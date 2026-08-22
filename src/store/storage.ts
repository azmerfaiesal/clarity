import type { Task, TaskList } from '../types'
import { addDays, todayStr } from '../utils/dateUtils'
import { makeId } from '../utils/taskUtils'

const TASKS_KEY = 'clarity.tasks.v1'
const LISTS_KEY = 'clarity.lists.v1'
const THEME_KEY = 'clarity.theme.v1'
const SEEDED_KEY = 'clarity.seeded.v1'

export function loadTasks(): Task[] | null {
  try {
    const raw = localStorage.getItem(TASKS_KEY)
    return raw ? (JSON.parse(raw) as Task[]) : null
  } catch {
    return null
  }
}

export function saveTasks(tasks: Task[]): void {
  try {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks))
  } catch {
    /* storage full / unavailable — fail silently */
  }
}

export function loadLists(): TaskList[] | null {
  try {
    const raw = localStorage.getItem(LISTS_KEY)
    return raw ? (JSON.parse(raw) as TaskList[]) : null
  } catch {
    return null
  }
}

export function saveLists(lists: TaskList[]): void {
  try {
    localStorage.setItem(LISTS_KEY, JSON.stringify(lists))
  } catch {
    /* ignore */
  }
}

export function loadTheme(): 'light' | 'dark' | null {
  const v = localStorage.getItem(THEME_KEY)
  return v === 'light' || v === 'dark' ? v : null
}

export function saveTheme(theme: 'light' | 'dark'): void {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    /* ignore */
  }
}

export function isSeeded(): boolean {
  return localStorage.getItem(SEEDED_KEY) === '1'
}

export function markSeeded(): void {
  try {
    localStorage.setItem(SEEDED_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function seedLists(): TaskList[] {
  const now = new Date().toISOString()
  return [
    { id: 'list-personal', name: 'Personal', color: '#6366f1', createdAt: now },
    { id: 'list-work', name: 'Work', color: '#0ea5e9', createdAt: now },
    { id: 'list-shopping', name: 'Shopping', color: '#10b981', createdAt: now },
    { id: 'list-projects', name: 'Projects', color: '#f59e0b', createdAt: now },
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
