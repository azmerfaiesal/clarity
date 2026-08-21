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
    <header className="flex items-center gap-2 pt-6 pb-5 sm:pt-10">
      <button
        type="button"
        onClick={onOpenMobileNav}
        aria-label="Open navigation"
        className="-ml-1 cursor-pointer rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 md:hidden dark:text-neutral-400 dark:hover:bg-neutral-800"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[22px] font-semibold tracking-tight text-neutral-900 sm:text-[26px] dark:text-neutral-50">
          {title}
          {subtitle && (
            <span className="ml-2.5 text-[14px] font-normal text-neutral-400 dark:text-neutral-500">
              {subtitle}
            </span>
          )}
        </h1>
        <p className="mt-0.5 text-[13px] text-neutral-400 dark:text-neutral-500">
          {count} {count === 1 ? 'task' : 'tasks'}
        </p>
      </div>

      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Search tasks"
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
        >
          <Search className="h-4 w-4" />
        </button>
        <FilterMenu filters={filters} lists={lists} onChange={onFiltersChange} />
        <SortMenu sort={sort} onChange={onSortChange} />
        <button
          type="button"
          onClick={onAddTask}
          className="ml-1.5 hidden cursor-pointer items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-indigo-500 sm:inline-flex"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          Add Task
        </button>
      </div>
    </header>
  )
}
