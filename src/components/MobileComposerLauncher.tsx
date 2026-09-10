import { ListTodo, NotebookPen, Plus, Repeat2 } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { nativeSelectionHaptic } from '../native/platform'

export type ComposerKind = 'task' | 'routine' | 'note'

const ACTIONS: Array<{
  kind: ComposerKind
  label: string
  Icon: typeof ListTodo
}> = [
  { kind: 'task', label: 'New task', Icon: ListTodo },
  { kind: 'routine', label: 'New routine', Icon: Repeat2 },
  { kind: 'note', label: 'New note', Icon: NotebookPen },
]

export function MobileComposerLauncher({
  open,
  onOpenChange,
  onChoose,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onChoose: (kind: ComposerKind, anchor: HTMLButtonElement) => void
}) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [anchor, setAnchor] = useState({ x: 0, y: 0 })

  useLayoutEffect(() => {
    if (!open) return
    const position = () => {
      const box = triggerRef.current?.getBoundingClientRect()
      if (box) setAnchor({ x: box.left + box.width / 2, y: box.top + box.height / 2 })
    }
    position()
    window.addEventListener('resize', position)
    return () => window.removeEventListener('resize', position)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onOpenChange(false)
      triggerRef.current?.focus()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onOpenChange, open])

  const toggle = () => {
    nativeSelectionHaptic()
    onOpenChange(!open)
  }

  const layer = (
    <div
      className="composer-launcher-layer"
      data-open={open || undefined}
      style={
        {
          '--composer-anchor-x': `${anchor.x}px`,
          '--composer-anchor-y': `${anchor.y}px`,
        } as CSSProperties
      }
    >
      <button
        type="button"
        aria-label="Dismiss creation menu"
        data-testid="composer-launcher-scrim"
        tabIndex={-1}
        className="composer-launcher-scrim"
        onClick={() => {
          onOpenChange(false)
          triggerRef.current?.focus()
        }}
      />
      <div className="composer-launcher-actions" aria-hidden={!open}>
        {ACTIONS.map(({ kind, label, Icon }, index) => (
          <button
            key={kind}
            type="button"
            aria-label={label}
            tabIndex={open ? 0 : -1}
            className="composer-launcher-action motion-interactive"
            style={{ '--composer-action-index': index } as CSSProperties}
            onClick={(event) => {
              nativeSelectionHaptic()
              onChoose(kind, event.currentTarget)
            }}
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={2.25} aria-hidden />
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <>
      {createPortal(layer, document.body)}
      <div className="composer-launcher" data-open={open || undefined}>
        <button
          ref={triggerRef}
          type="button"
          aria-label={open ? 'Close creation menu' : 'Create new'}
          aria-expanded={open}
          onClick={toggle}
          className="composer-launcher-trigger motion-primary motion-interactive"
        >
          <Plus className="composer-launcher-plus h-5 w-5" strokeWidth={2.5} aria-hidden />
        </button>
      </div>
    </>
  )
}
