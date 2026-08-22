import { Calendar, Copy, Flag, MoreHorizontal, Star, Tag, Trash2 } from 'lucide-react'
import type { Task, TaskList } from '../types'
import { formatDueDate } from '../utils/dateUtils'
import { PRIORITY_LABEL } from '../utils/taskUtils'
import { Dropdown, MenuDivider, MenuItem } from './Dropdown'
import { TaskCheckbox } from './TaskCheckbox'

const FLAG_COLOR: Record<string, string> = {
  low: 'text-sky-500',
  medium: 'text-amber-500',
  high: 'text-red-500',
}

export function TaskItem({
  task,
  lists,
  onEdit,
  onDelete,
  onToggleComplete,
  onToggleFavorite,
  onDuplicate,
}: {
  task: Task
  lists: TaskList[]
  onEdit: () => void
  onDelete: () => void
  onToggleComplete: () => void
  onToggleFavorite: () => void
  onDuplicate: () => void
}) {
  const due = formatDueDate(task.dueDate)
  const list = lists.find((l) => l.id === task.listId)

  return (
    <div
      className={`group anim-fade-slide-in flex items-start gap-3 rounded-xl border border-transparent px-3 py-2.5 transition-colors hover:border-neutral-200/70 hover:bg-white dark:hover:border-neutral-700/50 dark:hover:bg-neutral-900/60 ${
        task.completed ? 'opacity-55' : ''
      }`}
    >
      <TaskCheckbox
        completed={task.completed}
        priority={task.priority}
        onToggle={onToggleComplete}
      />

      <button
        type="button"
        onClick={onEdit}
        className="min-w-0 flex-1 cursor-pointer text-left"
        aria-label={`Edit task: ${task.title}`}
      >
        <div className="flex items-center gap-2">
          <span
            className={`truncate text-[14px] leading-snug text-neutral-900 dark:text-neutral-100 ${
              task.completed ? 'line-through decoration-neutral-400 dark:decoration-neutral-500' : ''
            }`}
          >
            {task.title}
          </span>
          {task.favorite && (
            <Star
              className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400"
              aria-label="Favorite"
            />
          )}
        </div>

        {task.description && (
          <p className="mt-0.5 truncate text-[13px] text-neutral-500 dark:text-neutral-400">
            {task.description}
          </p>
        )}

        {(due || list || task.tags.length > 0 || task.priority !== 'none') && (
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            {due && (
              <span
                className={`inline-flex items-center gap-1 text-[12px] ${
                  task.completed
                    ? 'text-neutral-400 dark:text-neutral-500'
                    : due.tone === 'overdue'
                      ? 'text-red-500 dark:text-red-400'
                      : due.tone === 'today'
                        ? 'text-indigo-500 dark:text-indigo-400'
                        : 'text-neutral-400 dark:text-neutral-500'
                }`}
              >
                <Calendar className="h-3 w-3" aria-hidden />
                {due.text}
              </span>
            )}
            {task.priority !== 'none' && (
              <span
                className={`inline-flex items-center gap-1 text-[12px] ${FLAG_COLOR[task.priority]}`}
              >
                <Flag className="h-3 w-3 fill-current" aria-hidden />
                <span className="sr-only">{PRIORITY_LABEL[task.priority]} priority</span>
              </span>
            )}
            {list && (
              <span className="inline-flex items-center gap-1.5 text-[12px] text-neutral-400 dark:text-neutral-500">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: list.color }}
                  aria-hidden
                />
                {list.name}
              </span>
            )}
            {task.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-0.5 rounded-md bg-neutral-100 px-1.5 py-px text-[11px] text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
              >
                <Tag className="h-2.5 w-2.5" aria-hidden />
                {tag}
              </span>
            ))}
          </div>
        )}
      </button>

      <div
        className="opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
        <Dropdown
          label="Task actions"
          trigger={({ toggle }) => (
            <button
              type="button"
              onClick={toggle}
              aria-label={`More actions for ${task.title}`}
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          )}
        >
          {(close) => (
            <>
              <MenuItem
                icon={<Star className={`h-4 w-4 ${task.favorite ? 'fill-amber-400 text-amber-400' : ''}`} />}
                onClick={() => {
                  onToggleFavorite()
                  close()
                }}
              >
                {task.favorite ? 'Remove from favorites' : 'Add to favorites'}
              </MenuItem>
              <MenuItem
                icon={<Copy className="h-4 w-4" />}
                onClick={() => {
                  onDuplicate()
                  close()
                }}
              >
                Duplicate
              </MenuItem>
              <MenuDivider />
              <MenuItem
                danger
                icon={<Trash2 className="h-4 w-4" />}
                onClick={() => {
                  onDelete()
                  close()
                }}
              >
                Delete
              </MenuItem>
            </>
          )}
        </Dropdown>
      </div>
    </div>
  )
}
