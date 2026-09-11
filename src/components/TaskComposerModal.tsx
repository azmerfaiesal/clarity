import { useRef, useState, type MouseEvent, type RefObject } from 'react'
import type { TaskList } from '../types'
import { usePresenceValue } from './MotionPresence'
import {
  TaskComposerFields,
  type TaskDraftInput,
} from './TaskComposerFields'
import { useComposerAnchor } from './useComposerAnchor'

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
  const [composerSession, setComposerSession] = useState(0)
  const dialogRef = useRef<HTMLElement>(null)
  const presence = usePresenceValue(open ? true : null, {
    onExited: () => anchorRef.current?.focus(),
  })
  useComposerAnchor(anchorRef, dialogRef, open)

  if (!presence) return null

  const interactive = presence.phase !== 'exiting'
  const close = () => {
    if (!interactive) return
    setComposerSession((session) => session + 1)
    onClose()
  }
  const submit = (input: TaskDraftInput) => {
    if (interactive) onSubmit(input)
  }
  const dismissBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
    event.stopPropagation()
    close()
  }

  return (
    <div
      className="native-modal-viewport global-composer-viewport motion-overlay fixed inset-0 z-50"
      data-motion-state={presence.phase}
      data-testid="task-composer-backdrop"
      onClick={dismissBackdrop}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Add a task"
        inert={!interactive}
        className="task-composer-modal global-composer-modal anchored-composer-modal motion-dialog"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !event.defaultPrevented) {
            event.preventDefault()
            close()
          }
        }}
      >
        <TaskComposerFields
          key={composerSession}
          lists={lists}
          defaultListId={defaultListId}
          defaultDueDate={defaultDueDate}
          autoFocus={interactive}
          onSubmit={submit}
          onCancel={close}
        />
      </section>
    </div>
  )
}
