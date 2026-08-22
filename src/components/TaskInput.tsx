import { Bell, Calendar, Flag, Inbox, Plus, Tag, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Priority, TaskList } from '../types'
import { addDays, todayStr } from '../utils/dateUtils'
import { PRIORITY_LABEL } from '../utils/taskUtils'

const PRIORITIES: Priority[] = ['none', 'low', 'medium', 'high']

const FLAG_STYLE: Record<Priority, string> = {
  none: 'text-faint',
  low: 'text-p-low',
  medium: 'text-p-med',
  high: 'text-p-high',
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
 className="group flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-dashed border-line px-3.5 py-2.5 text-left text-[14px] text-faint transition-colors hover:border-accent hover:text-accent"
      >
 <Plus className="h-4 w-4" aria-hidden />
        Add a task
 <kbd className="ml-auto hidden rounded-md border border-line px-1.5 py-0.5 font-mono text-[10px] text-faint group-hover:border-accent sm:inline">
          N
        </kbd>
      </button>
    )
  }

  return (
 <div className="anim-scale-in rounded-lg border border-line bg-raised shadow-sm shadow-black/5 dark:shadow-black/40">
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
 className="w-full bg-transparent text-[14px] font-medium text-ink outline-none placeholder:text-faint"
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
 className="mt-1 w-full bg-transparent text-[13px] text-muted outline-none placeholder:text-faint"
        />

 <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {/* Due date */}
          <label
 className={`relative inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-[12px] transition-colors ${
              dueDate
                ? 'border-accent/40 bg-accent-soft text-accent'
                : 'border-line text-muted hover:bg-surface'
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
 className="cursor-pointer rounded-md p-0.5 text-faint hover:text-ink"
              >
 <X className="h-3.5 w-3.5" />
              </button>
            </>
          )}

          {/* Priority */}
          <div
            role="radiogroup"
            aria-label="Priority"
 className="inline-flex items-center overflow-hidden rounded-md border border-line"
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
                    ? 'bg-accent-soft'
                    : 'hover:bg-surface'
                }`}
              >
                {p === 'none' ? (
 <span className="text-faint">–</span>
                ) : (
                  <Flag
 className={`h-3.5 w-3.5 ${FLAG_STYLE[p]} ${priority === p ? 'fill-current' : ''}`}
                  />
                )}
              </button>
            ))}
          </div>

          {/* List */}
 <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-line px-2 py-1 text-[12px] text-muted hover:bg-surface">
 <Inbox className="h-3.5 w-3.5" aria-hidden />
            <select
              aria-label="List"
              value={listId ?? ''}
              onChange={(e) => setListId(e.target.value || null)}
 className="cursor-pointer bg-transparent outline-none"
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
 <label className="inline-flex min-w-24 flex-1 cursor-text items-center gap-1.5 rounded-md border border-line px-2 py-1 text-[12px] text-muted sm:flex-none">
 <Tag className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="Tags, comma separated"
              aria-label="Tags"
 className="w-full min-w-20 bg-transparent outline-none placeholder:text-faint"
            />
          </label>

          {/* Reminder */}
          <label
 className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-[12px] ${
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
              onChange={(e) => setReminder(e.target.value)}
 className="cursor-pointer bg-transparent text-[12px] outline-none dark:[color-scheme:dark]"
            />
          </label>
        </div>
      </div>

 <div className="flex items-center justify-end gap-2 border-t border-line px-3 py-2">
        <button
          type="button"
          onClick={close}
 className="cursor-pointer rounded-lg px-3 py-1.5 text-[13px] font-medium text-muted hover:bg-surface"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!title.trim()}
 className="cursor-pointer rounded-lg bg-accent px-3.5 py-1.5 text-[13px] font-medium text-accent-ink transition-colors hover:bg-accent-hi disabled:cursor-not-allowed disabled:opacity-40"
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
 className={`cursor-pointer rounded-md border px-2 py-1 text-[12px] transition-colors ${
        current === value
          ? 'border-accent/50 bg-accent-soft text-accent'
          : 'border-line text-muted hover:bg-surface'
      }`}
    >
      {label}
    </button>
  )
}
