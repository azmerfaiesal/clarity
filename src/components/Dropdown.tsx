import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { nativeSelectionHaptic } from '../native/platform'
import { usePresenceValue } from './MotionPresence'

interface DropdownProps {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode
  children: (close: () => void) => ReactNode
  align?: 'left' | 'right'
  label?: string
}

const MARGIN = 8

/**
 * Popover dropdown: closes on outside click and Escape.
 *
 * The panel is portalled to `document.body` and positioned with `fixed`
 * coordinates. Rendering it inline looked simpler but broke in two ways — the
 * scrolling task column clipped it, and the row's fade-in wrapper (an opacity
 * transition) created a stacking context, so later rows painted over the menu
 * and swallowed clicks on its lower items.
 */
export function Dropdown({ trigger, children, align = 'right', label }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number; above: boolean } | null>(null)
  const anchorRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const place = useCallback(() => {
    const anchor = anchorRef.current
    const menu = menuRef.current
    if (!anchor || !menu) return
    const a = anchor.getBoundingClientRect()
    const m = menu.getBoundingClientRect()

    let top = a.bottom + 6
    let above = false
    if (top + m.height > window.innerHeight - MARGIN) {
      // Not enough room below — flip above the trigger, then clamp.
      top = Math.max(MARGIN, a.top - m.height - 6)
      above = true
    }

    let left = align === 'right' ? a.right - m.width : a.left
    left = Math.min(Math.max(MARGIN, left), window.innerWidth - m.width - MARGIN)

    setPos({ top, left, above })
  }, [align])

  const presence = usePresenceValue(open ? true : null, {
    onExited: () => setPos(null),
  })
  const presencePhase = presence?.phase
  const presenceValue = presence?.value

  useLayoutEffect(() => {
    if (!presenceValue || presencePhase === 'exiting') return
    place()
  }, [place, presencePhase, presenceValue])

  useEffect(() => {
    if (!open) return

    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node
      if (anchorRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    // Any scroll or resize would leave the panel stranded — just close it.
    const onReflow = () => setOpen(false)

    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('scroll', onReflow, true)
    window.addEventListener('resize', onReflow)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey, true)
      window.removeEventListener('scroll', onReflow, true)
      window.removeEventListener('resize', onReflow)
    }
  }, [open])

  return (
    <div ref={anchorRef} className="relative">
      {trigger({
        open,
        toggle: () => {
          if (!open) nativeSelectionHaptic()
          setOpen(!open)
        },
      })}
      {presence &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={label}
            style={{
              top: pos?.top ?? 0,
              left: pos?.left ?? 0,
              transformOrigin: `${align === 'right' ? 'right' : 'left'} ${pos?.above ? 'bottom' : 'top'}`,
              // Keep it out of sight until measured, so it never flashes at 0,0.
              visibility: pos ? 'visible' : 'hidden',
            }}
            data-motion-state={presence.phase}
            inert={presence.phase === 'exiting'}
            className="motion-popover fixed z-50 min-w-44 rounded-lg border border-line bg-raised p-1 shadow-xl shadow-black/10 dark:shadow-black/60"
          >
            {children(() => setOpen(false))}
          </div>,
          document.body,
        )}
    </div>
  )
}

export function MenuItem({
  icon,
  children,
  onClick,
  danger,
  active,
}: {
  icon?: ReactNode
  children: ReactNode
  onClick?: () => void
  danger?: boolean
  active?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`motion-interactive flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm ${
        danger
          ? 'text-danger hover:bg-danger-soft'
          : active
            ? 'bg-accent-soft text-ink'
            : 'text-muted hover:bg-surface hover:text-ink'
      }`}
    >
      {icon && <span className="shrink-0 text-faint">{icon}</span>}
      <span className="flex-1">{children}</span>
    </button>
  )
}

export function MenuDivider() {
  return <div className="mx-1 my-1 h-px bg-line" />
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <div className="label px-2.5 pt-2 pb-1.5">
      {children}
    </div>
  )
}
