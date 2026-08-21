import { Calendar, Flag, Inbox, Star, Tag, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Priority, Task, TaskList } from '../types'
import { formatTimestamp } from '../utils/dateUtils'
import { PRIORITY_LABEL } from '../utils/taskUtils'

const PRIORITIES: Priority[] = ['none', 'low', 'medium', 'high']

const FLAG_STYLE: Record<Priority, string> = {
  none: 'text-neutral-400 dark:text-neutral-500',
  low: 'text-sky-500',
  medium: 'text-amber-500',
  high: 'text-red-500',
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
      className="anim-fade-in fixed inset-0 z-50 flex items-end justify-center bg-neutral-950/30 p-0 backdrop-blur-[2px] sm:items-center sm:p-6 dark:bg-black/50"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit task"
        className="anim-scale-in flex max-h-[92dvh] w-full max-w-lg flex-col overflow-y-auto rounded-t-2xl border border-neutral-200 bg-white shadow-2xl sm:rounded-2xl dark:border-neutral-700 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3.5 dark:border-neutral-800">
          <span className="text-[13px] font-medium text-neutral-400 dark:text-neutral-500">
            Edit task
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setFavorite((f) => !f)}
              aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
              aria-pressed={favorite}
              className="cursor-pointer rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <Star
                className={`h-4 w-4 ${favorite ? 'fill-amber-400 text-amber-400' : ''}`}
              />
            </button>
            <button
              type="button"
              onClick={() => {
                onDelete()
                onClose()
              }}
              aria-label="Delete task"
              className="cursor-pointer rounded-lg p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/40"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="cursor-pointer rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
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
            className="w-full bg-transparent text-[16px] font-medium text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-neutral-100"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Notes"
            aria-label="Notes"
            rows={3}
            className="w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50/60 px-3 py-2.5 text-[14px] text-neutral-700 outline-none placeholder:text-neutral-400 focus:border-indigo-300 dark:border-neutral-700 dark:bg-neutral-800/40 dark:text-neutral-200 dark:focus:border-indigo-500/50"
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Due date" icon={<Calendar className="h-3.5 w-3.5" />}>
              <input
                type="date"
                value={dueDate ?? ''}
                onChange={(e) => setDueDate(e.target.value || null)}
                className="w-full bg-transparent text-[13px] text-neutral-700 outline-none dark:text-neutral-200 dark:[color-scheme:dark]"
              />
            </Field>
            <Field label="List" icon={<Inbox className="h-3.5 w-3.5" />}>
              <select
                value={listId ?? ''}
                onChange={(e) => setListId(e.target.value || null)}
                className="w-full cursor-pointer bg-transparent text-[13px] text-neutral-700 outline-none dark:bg-neutral-900 dark:text-neutral-200"
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
                className="w-full bg-transparent text-[13px] text-neutral-700 outline-none placeholder:text-neutral-400 dark:text-neutral-200"
              />
            </Field>
            <Field label="Reminder" icon={<Calendar className="h-3.5 w-3.5" />}>
              <input
                type="datetime-local"
                value={reminder}
                onChange={(e) => setReminder(e.target.value)}
                className="w-full bg-transparent text-[13px] text-neutral-700 outline-none dark:text-neutral-200 dark:[color-scheme:dark]"
              />
            </Field>
          </div>

          <div>
            <span className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-neutral-400 dark:text-neutral-500">
              <Flag className="h-3.5 w-3.5" /> Priority
            </span>
            <div
              role="radiogroup"
              aria-label="Priority"
              className="inline-flex overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-700"
            >
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={priority === p}
                  onClick={() => setPriority(p)}
                  className={`cursor-pointer px-3 py-1.5 text-[12px] transition-colors ${
                    priority === p
                      ? 'bg-neutral-100 font-medium text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100'
                      : 'text-neutral-500 hover:bg-neutral-50 dark:text-neutral-400 dark:hover:bg-neutral-800/60'
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

          <p className="text-[12px] text-neutral-400 dark:text-neutral-500">
            Created {formatTimestamp(task.createdAt)}
            {task.completedAt && ` · Completed ${formatTimestamp(task.completedAt)}`}
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-neutral-100 px-5 py-3 dark:border-neutral-800">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg px-3.5 py-2 text-[13px] font-medium text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!title.trim()}
            className="cursor-pointer rounded-lg bg-indigo-600 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
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
      <span className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-neutral-400 dark:text-neutral-500">
        {icon} {label}
      </span>
      <div className="rounded-lg border border-neutral-200 px-2.5 py-2 dark:border-neutral-700">
        {children}
      </div>
    </label>
  )
}
