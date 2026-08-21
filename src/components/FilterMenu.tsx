import { Check, Flag, ListFilter, Star } from 'lucide-react'
import type { Filters, Priority, TaskList } from '../types'
import { countActiveFilters, PRIORITY_LABEL } from '../utils/taskUtils'
import { DEFAULT_FILTERS } from '../types'
import { Dropdown, MenuDivider, MenuLabel } from './Dropdown'

const FLAG_COLOR: Record<Priority, string> = {
  none: 'text-neutral-400',
  low: 'text-sky-500',
  medium: 'text-amber-500',
  high: 'text-red-500',
}

export function FilterMenu({
  filters,
  lists,
  onChange,
}: {
  filters: Filters
  lists: TaskList[]
  onChange: (f: Filters) => void
}) {
  const activeCount = countActiveFilters(filters)

  const togglePriority = (p: Priority) => {
    const priorities = filters.priorities.includes(p)
      ? filters.priorities.filter((x) => x !== p)
      : [...filters.priorities, p]
    onChange({ ...filters, priorities })
  }

  const Row = ({
    selected,
    onClick,
    children,
  }: {
    selected: boolean
    onClick: () => void
    children: React.ReactNode
  }) => (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={selected}
      onClick={onClick}
      className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors ${
        selected
          ? 'text-neutral-900 dark:text-neutral-100'
          : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800'
      }`}
    >
      <span
        className={`flex h-4 w-4 items-center justify-center rounded-md border ${
          selected
            ? 'border-indigo-500 bg-indigo-500 text-white'
            : 'border-neutral-300 dark:border-neutral-600'
        }`}
      >
        {selected && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      {children}
    </button>
  )

  return (
    <Dropdown
      label="Filter tasks"
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-label="Filter tasks"
          className={`relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition-colors ${
            activeCount > 0
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300'
          }`}
        >
          <ListFilter className="h-4 w-4" />
          {activeCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[9px] font-semibold text-white">
              {activeCount}
            </span>
          )}
        </button>
      )}
    >
      {() => (
        <div className="max-h-96 w-60 overflow-y-auto">
          <MenuLabel>Status</MenuLabel>
          {(['all', 'active', 'completed'] as const).map((s) => (
            <Row
              key={s}
              selected={filters.status === s}
              onClick={() => onChange({ ...filters, status: s })}
            >
              {s === 'all' ? 'All' : s === 'active' ? 'Active' : 'Completed'}
            </Row>
          ))}
          <MenuDivider />
          <MenuLabel>Priority</MenuLabel>
          {(['high', 'medium', 'low', 'none'] as Priority[]).map((p) => (
            <Row key={p} selected={filters.priorities.includes(p)} onClick={() => togglePriority(p)}>
              <Flag className={`h-3.5 w-3.5 ${FLAG_COLOR[p]} ${filters.priorities.includes(p) ? 'fill-current' : ''}`} />
              {PRIORITY_LABEL[p]}
            </Row>
          ))}
          <MenuDivider />
          <MenuLabel>Due date</MenuLabel>
          {(
            [
              ['any', 'Any'],
              ['overdue', 'Overdue'],
              ['today', 'Today'],
              ['week', 'Next 7 days'],
              ['none', 'No date'],
            ] as const
          ).map(([v, label]) => (
            <Row key={v} selected={filters.due === v} onClick={() => onChange({ ...filters, due: v })}>
              {label}
            </Row>
          ))}
          <MenuDivider />
          <MenuLabel>List</MenuLabel>
          <Row
            selected={filters.listId === 'any'}
            onClick={() => onChange({ ...filters, listId: 'any' })}
          >
            Any list
          </Row>
          {lists.map((l) => (
            <Row
              key={l.id}
              selected={filters.listId === l.id}
              onClick={() => onChange({ ...filters, listId: l.id })}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} />
              {l.name}
            </Row>
          ))}
          <MenuDivider />
          <Row
            selected={filters.favoriteOnly}
            onClick={() => onChange({ ...filters, favoriteOnly: !filters.favoriteOnly })}
          >
            <Star className={`h-3.5 w-3.5 ${filters.favoriteOnly ? 'fill-amber-400 text-amber-400' : 'text-neutral-400'}`} />
            Favorites only
          </Row>
          {activeCount > 0 && (
            <>
              <MenuDivider />
              <button
                type="button"
                onClick={() => onChange(DEFAULT_FILTERS)}
                className="w-full cursor-pointer rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-500/10"
              >
                Clear all filters
              </button>
            </>
          )}
        </div>
      )}
    </Dropdown>
  )
}
