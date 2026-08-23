import { Menu, Plus, Search } from 'lucide-react'
import type { Filters, SortMode, TaskList } from '../types'
import { FilterMenu } from './FilterMenu'
import { SortMenu } from './SortMenu'

export function Header({
  title,
  subtitle,
  count,
  filters,
  sort,
  lists,
  onFiltersChange,
  onSortChange,
  onOpenSearch,
  onOpenMobileNav,
  onAddTask,
}: {
  title: string
  subtitle?: string
  count: number
  filters: Filters
  sort: SortMode
  lists: TaskList[]
  onFiltersChange: (f: Filters) => void
  onSortChange: (s: SortMode) => void
  onOpenSearch: () => void
  onOpenMobileNav: () => void
  onAddTask: () => void
}) {
  return (
    <header className="flex items-center gap-2 pt-6 pb-6 sm:pt-10">
      <button
        type="button"
        onClick={onOpenMobileNav}
        aria-label="Open navigation"
        className="-ml-1 cursor-pointer rounded-md p-2 text-muted transition-colors hover:bg-surface hover:text-ink md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-semibold tracking-[-0.02em] text-ink sm:text-2xl">
          {title}
          {subtitle && (
            <span className="ml-3 font-mono text-xs font-normal tracking-normal text-faint">
              {subtitle}
            </span>
          )}
        </h1>
        <p className="mt-1 font-mono text-2xs tracking-[0.06em] text-faint uppercase">
          {count} {count === 1 ? 'task' : 'tasks'}
        </p>
      </div>

      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Search tasks"
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-faint transition-colors hover:bg-accent-soft hover:text-accent"
        >
          <Search className="h-4 w-4" />
        </button>
        <FilterMenu filters={filters} lists={lists} onChange={onFiltersChange} />
        <SortMenu sort={sort} onChange={onSortChange} />
        <button
          type="button"
          onClick={onAddTask}
          className="ml-2 hidden cursor-pointer items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink transition-all hover:bg-accent-hi hover:glow-sm sm:inline-flex"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          Add Task
        </button>
      </div>
    </header>
  )
}
