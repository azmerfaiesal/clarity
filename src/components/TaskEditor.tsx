import { Calendar, Flag, Inbox, Star, Tag, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Priority, Task, TaskList } from '../types'
import { formatTimestamp } from '../utils/dateUtils'
import { PRIORITY_LABEL } from '../utils/taskUtils'

const PRIORITIES: Priority[] = ['none', 'low', 'medium', 'high']

const FLAG_STYLE: Record<Priority, string> = {
  none: 'text-faint',
  low: 'text-p-low',
  medium: 'text-p-med',
  high: 'text-p-high',
}

export function TaskEditor({
  task,
  lists,
  onSave,
  onDelete,
  onClose,
}: {
  task: Task
  lists: TaskList[]
  onSave: (patch: Partial<Task>) => void
  onDelete: () => void
  onClose: () => void
}) {
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description)
  const [priority, setPriority] = useState<Priority>(task.priority)
  const [dueDate, setDueDate] = useState<string | null>(task.dueDate)
  const [listId, setListId] = useState<string | null>(task.listId)
  const [tagsInput, setTagsInput] = useState(task.tags.join(', '))
  const [favorite, setFavorite] = useState(task.favorite)
  const [reminder, setReminder] = useState(task.reminder ?? '')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const save = () => {
    if (!title.trim()) return
    onSave({
      title: title.trim(),
      description: description.trim(),
      priority,
      dueDate,
      listId,
      tags: tagsInput
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean),
      favorite,
      reminder: reminder || null,
    })
    onClose()
  }

  return (
    <div
 className="anim-fade-in fixed inset-0 z-50 flex items-end justify-center bg-[var(--scrim)] p-0 backdrop-blur-[3px] sm:items-center sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit task"
 className="anim-scale-in flex max-h-[92dvh] w-full max-w-lg flex-col overflow-y-auto rounded-t-xl border border-line bg-raised shadow-2xl shadow-black/20 sm:rounded-xl dark:shadow-black/70"
        onClick={(e) => e.stopPropagation()}
      >
 <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
 <span className="text-sm font-medium text-faint">
            Edit task
          </span>
 <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setFavorite((f) => !f)}
              aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
              aria-pressed={favorite}
 className="cursor-pointer rounded-lg p-1.5 text-faint hover:bg-surface"
            >
              <Star
 className={`h-4 w-4 ${favorite ? 'fill-fav text-fav' : ''}`}
              />
            </button>
            <button
              type="button"
              onClick={() => {
                onDelete()
                onClose()
              }}
              aria-label="Delete task"
 className="cursor-pointer rounded-lg p-1.5 text-faint hover:bg-danger-soft hover:text-danger"
            >
 <Trash2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
 className="cursor-pointer rounded-lg p-1.5 text-faint hover:bg-surface"
            >
 <X className="h-4 w-4" />
            </button>
          </div>
        </div>

 <div className="space-y-4 px-5 py-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                save()
              }
            }}
            placeholder="Task name"
            aria-label="Task name"
            autoFocus
 className="w-full bg-transparent text-md font-medium text-ink outline-none placeholder:text-faint"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Notes"
            aria-label="Notes"
            rows={3}
 className="w-full resize-none rounded-lg border border-line bg-surface px-3 py-2.5 text-base text-ink outline-none placeholder:text-faint focus:border-accent"
          />

 <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
 <Field label="Due date" icon={<Calendar className="h-3.5 w-3.5" />}>
              <input
                type="date"
                value={dueDate ?? ''}
                onChange={(e) => setDueDate(e.target.value || null)}
 className="w-full bg-transparent text-sm text-ink outline-none"
              />
            </Field>
 <Field label="List" icon={<Inbox className="h-3.5 w-3.5" />}>
              <select
                value={listId ?? ''}
                onChange={(e) => setListId(e.target.value || null)}
 className="w-full cursor-pointer bg-transparent text-sm text-ink outline-none"
              >
                <option value="">Inbox</option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </Field>
 <Field label="Tags" icon={<Tag className="h-3.5 w-3.5" />}>
              <input
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="comma, separated"
 className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-faint"
              />
            </Field>
 <Field label="Reminder" icon={<Calendar className="h-3.5 w-3.5" />}>
              <input
                type="datetime-local"
                value={reminder}
                onChange={(e) => setReminder(e.target.value)}
 className="w-full bg-transparent text-sm text-ink outline-none"
              />
            </Field>
          </div>

          <div>
 <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-faint">
 <Flag className="h-3.5 w-3.5" /> Priority
            </span>
            <div
              role="radiogroup"
              aria-label="Priority"
 className="inline-flex overflow-hidden rounded-md border border-line"
            >
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={priority === p}
                  onClick={() => setPriority(p)}
 className={`cursor-pointer px-3 py-1.5 text-xs transition-colors ${
                    priority === p
                      ? 'bg-accent-soft font-medium text-ink'
                      : 'text-muted hover:bg-surface'
                  }`}
                >
 <span className="inline-flex items-center gap-1.5">
                    {p !== 'none' && (
                      <Flag
 className={`h-3 w-3 ${FLAG_STYLE[p]} ${priority === p ? 'fill-current' : ''}`}
                      />
                    )}
                    {PRIORITY_LABEL[p]}
                  </span>
                </button>
              ))}
            </div>
          </div>

 <p className="text-xs text-faint">
            Created {formatTimestamp(task.createdAt)}
            {task.completedAt && ` · Completed ${formatTimestamp(task.completedAt)}`}
          </p>
        </div>

 <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
          <button
            type="button"
            onClick={onClose}
 className="cursor-pointer rounded-lg px-3.5 py-2 text-sm font-medium text-muted hover:bg-surface"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!title.trim()}
 className="cursor-pointer rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hi disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  icon,
  children,
}: {
  label: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
 <label className="block">
 <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-faint">
        {icon} {label}
      </span>
 <div className="rounded-md border border-line px-2.5 py-2">
        {children}
      </div>
    </label>
  )
}
