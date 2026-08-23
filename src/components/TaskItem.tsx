import { Calendar, Copy, Flag, MoreHorizontal, Star, Trash2 } from 'lucide-react'
import type { Task, TaskList } from '../types'
import { formatDueDate } from '../utils/dateUtils'
import { PRIORITY_LABEL } from '../utils/taskUtils'
import { Dropdown, MenuDivider, MenuItem } from './Dropdown'
import { TaskCheckbox } from './TaskCheckbox'

// Priority reads as value plus fill: high is solid ink, medium a solid mid
// grey, low an outline. No hue involved.
const FLAG_COLOR: Record<string, string> = {
  low: 'text-p-low',
  medium: 'text-p-med',
  high: 'text-p-high',
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
      className={`group anim-fade-slide-in relative flex items-start gap-3 rounded-lg border border-transparent px-3 py-2.5 transition-colors hover:border-line hover:bg-surface ${
        task.completed ? 'opacity-50' : ''
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
            className={`truncate text-[14px] leading-snug text-ink ${
              task.completed ? 'line-through decoration-faint' : ''
            }`}
          >
            {task.title}
          </span>
          {task.favorite && (
            <Star className="h-3.5 w-3.5 shrink-0 fill-ink text-ink" aria-label="Favorite" />
          )}
        </div>

        {task.description && (
          <p className="mt-0.5 truncate text-[13px] text-muted">{task.description}</p>
        )}

        {(due || list || task.tags.length > 0 || task.priority !== 'none') && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] tracking-tight">
            {due && (
              <span
                className={`inline-flex items-center gap-1 ${
                  task.completed
                    ? 'text-faint'
                    : due.tone === 'overdue'
                      ? 'font-semibold text-ink'
                      : due.tone === 'today'
                        ? 'text-ink'
                        : 'text-faint'
                }`}
              >
                <Calendar className="h-3 w-3" aria-hidden />
                {due.text}
              </span>
            )}
            {task.priority !== 'none' && (
              <span className={`inline-flex items-center gap-1 ${FLAG_COLOR[task.priority]}`}>
                <Flag
                  className={`h-3 w-3 ${task.priority === 'low' ? '' : 'fill-current'}`}
                  aria-hidden
                />
                <span className="sr-only">{PRIORITY_LABEL[task.priority]} priority</span>
              </span>
            )}
            {list && (
              <span className="inline-flex items-center gap-1.5 text-faint">
                <span
                  className="h-1.5 w-1.5 rounded-full swatch"
                  style={{ backgroundColor: list.color }}
                  aria-hidden
                />
                {list.name}
              </span>
            )}
            {task.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded border border-line px-1.5 py-px text-[10.5px] text-muted"
              >
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
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-faint transition-colors hover:bg-accent-soft hover:text-accent"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          )}
        >
          {(close) => (
            <>
              <MenuItem
                icon={
                  <Star className={`h-4 w-4 ${task.favorite ? 'fill-ink text-ink' : ''}`} />
                }
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
