import { Bell, Calendar, Flag, Inbox, Plus, Tag, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Priority, TaskList } from '../types'
import { addDays, todayStr } from '../utils/dateUtils'
import { PRIORITY_LABEL } from '../utils/taskUtils'

const PRIORITIES: Priority[] = ['none', 'low', 'medium', 'high']

const FLAG_STYLE: Record<Priority, string> = {
  none: 'text-neutral-400 dark:text-neutral-500',
  low: 'text-sky-500',
  medium: 'text-amber-500',
  high: 'text-red-500',
}

/** Quick-add input that expands into a compact creation form. Enter creates the task. */
export function TaskInput({
  lists,
  defaultListId,
  defaultDueDate,
  autoFocus,
  onSubmit,
  onCancel,
}: {
  lists: TaskList[]
  defaultListId?: string | null
  defaultDueDate?: string | null
  autoFocus?: boolean
  onSubmit: (input: {
    title: string
    description: string
    priority: Priority
    dueDate: string | null
    listId: string | null
    tags: string[]
    reminder: string | null
  }) => void
  onCancel?: () => void
}) {
  const [open, setOpen] = useState(!!autoFocus)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<Priority>('none')
  const [dueDate, setDueDate] = useState<string | null>(defaultDueDate ?? null)
  const [listId, setListId] = useState<string | null>(defaultListId ?? null)
  const [tagsInput, setTagsInput] = useState('')
  const [reminder, setReminder] = useState('')
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) titleRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (autoFocus) setOpen(true)
  }, [autoFocus])

  const reset = () => {
    setTitle('')
    setDescription('')
    setPriority('none')
    setDueDate(defaultDueDate ?? null)
    setListId(defaultListId ?? null)
    setTagsInput('')
    setReminder('')
  }

  const submit = () => {
    const trimmed = title.trim()
    if (!trimmed) return
    onSubmit({
      title: trimmed,
      description,
      priority,
      dueDate,
      listId,
      tags: tagsInput
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean),
      reminder: reminder || null,
    })
    reset()
    titleRef.current?.focus()
  }

  const close = () => {
    reset()
    setOpen(false)
    onCancel?.()
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-dashed border-neutral-200 px-3.5 py-2.5 text-left text-[14px] text-neutral-400 transition-colors hover:border-indigo-300 hover:text-indigo-500 dark:border-neutral-700 dark:text-neutral-500 dark:hover:border-indigo-500/60 dark:hover:text-indigo-400"
      >
        <Plus className="h-4 w-4" aria-hidden />
        Add a task
        <kbd className="ml-auto hidden rounded-md border border-neutral-200 px-1.5 py-0.5 text-[10px] font-medium text-neutral-400 group-hover:border-indigo-200 sm:inline dark:border-neutral-700 dark:group-hover:border-indigo-500/40">
          N
        </kbd>
      </button>
    )
  }

  return (
    <div className="anim-scale-in rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
      <div className="p-3">
        <input
          ref={titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              close()
            }
          }}
          placeholder="Task name"
          aria-label="Task name"
          className="w-full bg-transparent text-[14px] font-medium text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-neutral-100 dark:placeholder:text-neutral-500"
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            } else if (e.key === 'Escape') {
              close()
            }
          }}
          placeholder="Description (optional)"
          aria-label="Description"
          className="mt-1 w-full bg-transparent text-[13px] text-neutral-600 outline-none placeholder:text-neutral-400 dark:text-neutral-400 dark:placeholder:text-neutral-500"
        />

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {/* Due date */}
          <label
            className={`relative inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-1 text-[12px] transition-colors ${
              dueDate
                ? 'border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-400'
                : 'border-neutral-200 text-neutral-500 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" aria-hidden />
            {dueDate ?? 'Due date'}
            <input
              type="date"
              aria-label="Due date"
              value={dueDate ?? ''}
              onChange={(e) => setDueDate(e.target.value || null)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </label>
          {dueDate && (
            <>
              <QuickDate label="Today" value={todayStr()} current={dueDate} onPick={setDueDate} />
              <QuickDate
                label="Tomorrow"
                value={addDays(todayStr(), 1)}
                current={dueDate}
                onPick={setDueDate}
              />
              <button
                type="button"
                aria-label="Clear due date"
                onClick={() => setDueDate(null)}
                className="cursor-pointer rounded-md p-0.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          )}

          {/* Priority */}
          <div
            role="radiogroup"
            aria-label="Priority"
            className="inline-flex items-center overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-700"
          >
            {PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={priority === p}
                title={PRIORITY_LABEL[p]}
                onClick={() => setPriority(p)}
                className={`cursor-pointer px-2 py-1 text-[12px] transition-colors ${
                  priority === p
                    ? 'bg-neutral-100 dark:bg-neutral-800'
                    : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/60'
                }`}
              >
                {p === 'none' ? (
                  <span className="text-neutral-400 dark:text-neutral-500">–</span>
                ) : (
                  <Flag
                    className={`h-3.5 w-3.5 ${FLAG_STYLE[p]} ${priority === p ? 'fill-current' : ''}`}
                  />
                )}
              </button>
            ))}
          </div>

          {/* List */}
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-neutral-200 px-2 py-1 text-[12px] text-neutral-500 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800">
            <Inbox className="h-3.5 w-3.5" aria-hidden />
            <select
              aria-label="List"
              value={listId ?? ''}
              onChange={(e) => setListId(e.target.value || null)}
              className="cursor-pointer bg-transparent outline-none dark:bg-neutral-900"
            >
              <option value="">Inbox</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>

          {/* Tags */}
          <label className="inline-flex min-w-24 flex-1 cursor-text items-center gap-1.5 rounded-lg border border-neutral-200 px-2 py-1 text-[12px] text-neutral-500 sm:flex-none dark:border-neutral-700 dark:text-neutral-400">
            <Tag className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="Tags, comma separated"
              aria-label="Tags"
              className="w-full min-w-20 bg-transparent outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
            />
          </label>

          {/* Reminder */}
          <label
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-1 text-[12px] ${
              reminder
                ? 'border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-400'
                : 'border-neutral-200 text-neutral-500 dark:border-neutral-700 dark:text-neutral-400'
            }`}
          >
            <Bell className="h-3.5 w-3.5" aria-hidden />
            <input
              type="datetime-local"
              aria-label="Reminder"
              value={reminder}
              onChange={(e) => setReminder(e.target.value)}
              className="cursor-pointer bg-transparent text-[12px] outline-none dark:[color-scheme:dark]"
            />
          </label>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-neutral-100 px-3 py-2 dark:border-neutral-800">
        <button
          type="button"
          onClick={close}
          className="cursor-pointer rounded-lg px-3 py-1.5 text-[13px] font-medium text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!title.trim()}
          className="cursor-pointer rounded-lg bg-indigo-600 px-3.5 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Add task
        </button>
      </div>
    </div>
  )
}

function QuickDate({
  label,
  value,
  current,
  onPick,
}: {
  label: string
  value: string
  current: string
  onPick: (v: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(value)}
      className={`cursor-pointer rounded-lg border px-2 py-1 text-[12px] transition-colors ${
        current === value
          ? 'border-indigo-300 bg-indigo-50 text-indigo-600 dark:border-indigo-500/50 dark:bg-indigo-500/10 dark:text-indigo-400'
          : 'border-neutral-200 text-neutral-500 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800'
      }`}
    >
      {label}
    </button>
  )
}
