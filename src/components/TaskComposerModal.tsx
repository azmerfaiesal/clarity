import type { MouseEvent, RefObject } from 'react'
import type { TaskList } from '../types'
import { usePresenceValue } from './MotionPresence'
import {
  TaskComposerFields,
  type TaskDraftInput,
} from './TaskComposerFields'

export type TaskComposerModalProps = {
  open: boolean
  anchorRef: RefObject<HTMLElement | null>
  lists: TaskList[]
  defaultListId?: string | null
  defaultDueDate?: string | null
  onSubmit: (input: TaskDraftInput) => void
  onClose: () => void
}

export function TaskComposerModal({
  open,
  anchorRef,
  lists,
  defaultListId,
  defaultDueDate,
  onSubmit,
  onClose,
}: TaskComposerModalProps) {
  const presence = usePresenceValue(open ? true : null, {
    onExited: () => anchorRef.current?.focus(),
  })

  if (!presence) return null

  const interactive = presence.phase !== 'exiting'
  const close = () => {
    if (interactive) onClose()
  }
  const submit = (input: TaskDraftInput) => {
    if (interactive) onSubmit(input)
  }
  const dismissBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) close()
  }

  return (
    <div
      className="native-modal-viewport motion-overlay fixed inset-0 z-50"
      data-motion-state={presence.phase}
      data-testid="task-composer-backdrop"
      inert={!interactive}
      onClick={dismissBackdrop}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Add a task"
        className="task-composer-modal motion-dialog"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !event.defaultPrevented) {
            event.preventDefault()
            close()
          }
        }}
      >
        <TaskComposerFields
          lists={lists}
          defaultListId={defaultListId}
          defaultDueDate={defaultDueDate}
          autoFocus
          onSubmit={submit}
          onCancel={close}
        />
      </section>
    </div>
  )
}
