import { Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { TaskList } from '../types'
import { TaskComposerFields, type TaskDraftInput } from './TaskComposerFields'

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
  onSubmit: (input: TaskDraftInput) => void
  onCancel?: () => void
}) {
  const [open, setOpen] = useState(!!autoFocus)
  const wrapRef = useRef<HTMLDivElement>(null)

  // The form sits at the foot of the list, so opening it has to bring it into
  // view. Shared fields handle focus without scrolling; only this desktop
  // disclosure owns the smooth scroll into the inline form.
  useEffect(() => {
    if (!open) return
    const id = window.setTimeout(
      () => wrapRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
      60,
    )
    return () => window.clearTimeout(id)
  }, [open])

  useEffect(() => {
    if (autoFocus) setOpen(true)
  }, [autoFocus])

  const close = () => {
    setOpen(false)
    onCancel?.()
  }

  // Both states live in one tree so the form can grow out of the button rather
  // than replace it: swapping two elements cannot be animated, a disclosure
  // that opens from zero height can. The panel is inert while closed, so the
  // form stays mounted without anything in it being tabbable or read out.
  return (
    <div ref={wrapRef}>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-dashed border-line px-3.5 py-2.5 text-left text-base text-faint transition-colors hover:border-accent hover:text-accent"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add a task
          <kbd className="ml-auto hidden rounded-md border border-line px-1.5 py-0.5 font-mono text-3xs text-faint group-hover:border-accent sm:inline">
            N
          </kbd>
        </button>
      )}

      <div className="disclosure" data-open={open} inert={!open}>
        <div>
          <TaskComposerFields
            lists={lists}
            defaultListId={defaultListId}
            defaultDueDate={defaultDueDate}
            autoFocus={open}
            onSubmit={onSubmit}
            onCancel={close}
          />
        </div>
      </div>
    </div>
  )
}
