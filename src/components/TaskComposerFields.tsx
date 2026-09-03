import { Bell, Calendar, Flag, Inbox, Tag, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Priority, TaskList } from '../types'
import { addDays, fromDateTimeLocal, todayStr } from '../utils/dateUtils'
import { PRIORITY_LABEL } from '../utils/taskUtils'

const PRIORITIES: Priority[] = ['none', 'low', 'medium', 'high']

const FLAG_STYLE: Record<Priority, string> = {
  none: 'text-faint',
  low: 'text-p-low',
  medium: 'text-p-med',
  high: 'text-p-high',
}

export type TaskDraftInput = {
  title: string
  description: string
  priority: Priority
  dueDate: string | null
  listId: string | null
  tags: string[]
  reminder: string | null
}

export type TaskComposerFieldsProps = {
  lists: TaskList[]
  defaultListId?: string | null
  defaultDueDate?: string | null
  autoFocus?: boolean
  onSubmit: (input: TaskDraftInput) => void
  onCancel: () => void
}

/** Shared task-draft fields used by both the inline and native modal composers. */
export function TaskComposerFields({
  lists,
  defaultListId,
  defaultDueDate,
  autoFocus,
  onSubmit,
  onCancel,
}: TaskComposerFieldsProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<Priority>('none')
  const [dueDate, setDueDate] = useState<string | null>(defaultDueDate ?? null)
  const [listId, setListId] = useState<string | null>(defaultListId ?? null)
  const [tagsInput, setTagsInput] = useState('')
  const [reminder, setReminder] = useState('')
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus) titleRef.current?.focus({ preventScroll: true })
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
        .map((tag) => tag.trim().replace(/^#/, ''))
        .filter(Boolean),
      reminder: fromDateTimeLocal(reminder),
    })
    reset()
    onCancel()
  }

  const close = () => {
    reset()
    onCancel()
  }

  return (
    <div className="rounded-lg border border-line bg-raised shadow-sm shadow-black/5 dark:shadow-black/40">
      <div className="p-3">
        <input
          ref={titleRef}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              submit()
            } else if (event.key === 'Escape') {
              event.preventDefault()
              close()
            }
          }}
          placeholder="Task name"
          aria-label="Task name"
          className="w-full bg-transparent text-base font-medium text-ink outline-none placeholder:text-faint"
        />
        <input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              submit()
            } else if (event.key === 'Escape') {
              event.preventDefault()
              close()
            }
          }}
          placeholder="Description (optional)"
          aria-label="Description"
          className="mt-1 w-full bg-transparent text-sm text-muted outline-none placeholder:text-faint"
        />

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {/* Due date. The field itself is visible rather than an invisible
              overlay on a label: a transparent date input gives no sign it can
              be typed into, and Safari has no calendar popup to fall back on,
              so from any view without a date already set the control read as
              dead. The two shortcuts show whether or not a date is set, so one
              tap is enough. */}
          <label
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors ${
              dueDate
                ? 'border-accent/40 bg-accent-soft text-accent'
                : 'border-line text-muted hover:bg-surface'
            }`}
          >
            <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <input
              type="date"
              aria-label="Due date"
              value={dueDate ?? ''}
              onChange={(event) => setDueDate(event.target.value || null)}
              className="cursor-pointer bg-transparent text-xs outline-none dark:[color-scheme:dark]"
            />
          </label>
          <QuickDate label="Today" value={todayStr()} current={dueDate} onPick={setDueDate} />
          <QuickDate
            label="Tomorrow"
            value={addDays(todayStr(), 1)}
            current={dueDate}
            onPick={setDueDate}
          />
          {dueDate && (
            <button
              type="button"
              aria-label="Clear due date"
              title="Clear due date"
              onClick={() => setDueDate(null)}
              className="cursor-pointer rounded p-0.5 text-faint transition-colors hover:text-danger"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          <div
            role="radiogroup"
            aria-label="Priority"
            className="inline-flex items-center overflow-hidden rounded-md border border-line"
          >
            {PRIORITIES.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={priority === value}
                title={PRIORITY_LABEL[value]}
                onClick={() => setPriority(value)}
                className={`cursor-pointer px-2 py-1 text-xs transition-colors ${
                  priority === value ? 'bg-accent-soft' : 'hover:bg-surface'
                }`}
              >
                {value === 'none' ? (
                  <span className="text-faint">–</span>
                ) : (
                  <Flag
                    className={`h-3.5 w-3.5 ${FLAG_STYLE[value]} ${priority === value ? 'fill-current' : ''}`}
                  />
                )}
              </button>
            ))}
          </div>

          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-line px-2 py-1 text-xs text-muted hover:bg-surface">
            <Inbox className="h-3.5 w-3.5" aria-hidden />
            <select
              aria-label="Category"
              value={listId ?? ''}
              onChange={(event) => setListId(event.target.value || null)}
              className="cursor-pointer bg-transparent outline-none"
            >
              <option value="">Inbox</option>
              {lists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </select>
          </label>

          <label className="inline-flex min-w-24 flex-1 cursor-text items-center gap-1.5 rounded-md border border-line px-2 py-1 text-xs text-muted sm:flex-none">
            <Tag className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <input
              value={tagsInput}
              onChange={(event) => setTagsInput(event.target.value)}
              placeholder="Tags, comma separated"
              aria-label="Tags"
              className="w-full min-w-20 bg-transparent outline-none placeholder:text-faint"
            />
          </label>

          <label
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${
              reminder
                ? 'border-accent/40 bg-accent-soft text-accent'
                : 'border-line text-muted'
            }`}
          >
            <Bell className="h-3.5 w-3.5" aria-hidden />
            <input
              type="datetime-local"
              aria-label="Reminder"
              value={reminder}
              onChange={(event) => setReminder(event.target.value)}
              className="cursor-pointer bg-transparent text-xs outline-none dark:[color-scheme:dark]"
            />
          </label>
          {reminder && (
            <button
              type="button"
              aria-label="Clear reminder"
              title="Clear reminder"
              onClick={() => setReminder('')}
              className="cursor-pointer rounded p-0.5 text-faint transition-colors hover:text-danger"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-line px-3 py-2">
        <button
          type="button"
          onClick={close}
          className="cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium text-muted hover:bg-surface"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!title.trim()}
          className="cursor-pointer rounded-lg bg-accent px-3.5 py-1.5 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hi disabled:cursor-not-allowed disabled:opacity-40"
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
  current: string | null
  onPick: (value: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(value)}
      className={`cursor-pointer rounded-md border px-2 py-1 text-xs transition-colors ${
        current === value
          ? 'border-accent/50 bg-accent-soft text-accent'
          : 'border-line text-muted hover:bg-surface'
      }`}
    >
      {label}
    </button>
  )
}
