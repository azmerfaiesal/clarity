import { Check, Flag, ListFilter, Star } from 'lucide-react'
import type { Filters, Priority, TaskList } from '../types'
import { countActiveFilters, PRIORITY_LABEL } from '../utils/taskUtils'
import { DEFAULT_FILTERS } from '../types'
import { Dropdown, MenuDivider, MenuLabel } from './Dropdown'

const FLAG_COLOR: Record<Priority, string> = {
  none: 'text-faint',
  low: 'text-p-low',
  medium: 'text-p-med',
  high: 'text-p-high',
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
      className={`flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] transition-colors ${
        selected ? 'text-ink' : 'text-muted hover:bg-surface hover:text-ink'
      }`}
    >
      <span
        className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
          selected ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong'
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
          className={`relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-md transition-colors ${
            activeCount > 0
              ? 'bg-accent-soft text-accent'
              : 'text-faint hover:bg-accent-soft hover:text-accent'
          }`}
        >
          <ListFilter className="h-4 w-4" />
          {activeCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent font-mono text-[9px] font-semibold text-accent-ink">
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
            <Star className={`h-3.5 w-3.5 ${filters.favoriteOnly ? 'fill-p-med text-p-med' : 'text-faint'}`} />
            Favorites only
          </Row>
          {activeCount > 0 && (
            <>
              <MenuDivider />
              <button
                type="button"
                onClick={() => onChange(DEFAULT_FILTERS)}
                className="w-full cursor-pointer rounded-md px-2.5 py-2 text-left text-[13px] font-medium text-accent transition-colors hover:bg-accent-soft"
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
