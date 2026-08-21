import { ArrowDownWideNarrow, Calendar, Check, Flag, GripVertical, LetterText, Clock } from 'lucide-react'
import type { SortMode } from '../types'
import { Dropdown, MenuItem, MenuLabel } from './Dropdown'

const OPTIONS: { value: SortMode; label: string; icon: React.ReactNode }[] = [
  { value: 'manual', label: 'Manual order', icon: <GripVertical className="h-4 w-4" /> },
  { value: 'dueDate', label: 'Due date', icon: <Calendar className="h-4 w-4" /> },
  { value: 'priority', label: 'Priority', icon: <Flag className="h-4 w-4" /> },
  { value: 'created', label: 'Date created', icon: <Clock className="h-4 w-4" /> },
  { value: 'alpha', label: 'Alphabetical', icon: <LetterText className="h-4 w-4" /> },
]

export function SortMenu({
  sort,
  onChange,
}: {
  sort: SortMode
  onChange: (s: SortMode) => void
}) {
  return (
    <Dropdown
      label="Sort tasks"
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-label="Sort tasks"
          className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition-colors ${
            sort !== 'manual'
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300'
          }`}
        >
          <ArrowDownWideNarrow className="h-4 w-4" />
        </button>
      )}
    >
      {(close) => (
        <>
          <MenuLabel>Sort by</MenuLabel>
          {OPTIONS.map((o) => (
            <MenuItem
              key={o.value}
              icon={o.icon}
              active={sort === o.value}
              onClick={() => {
                onChange(o.value)
                close()
              }}
            >
              <span className="flex flex-1 items-center justify-between">
                {o.label}
                {sort === o.value && <Check className="h-3.5 w-3.5 text-indigo-500" />}
              </span>
            </MenuItem>
          ))}
        </>
      )}
    </Dropdown>
  )
}
