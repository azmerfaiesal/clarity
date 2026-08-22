import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

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
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const anchorRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const place = useCallback(() => {
    const anchor = anchorRef.current
    const menu = menuRef.current
    if (!anchor || !menu) return
    const a = anchor.getBoundingClientRect()
    const m = menu.getBoundingClientRect()

    let top = a.bottom + 6
    if (top + m.height > window.innerHeight - MARGIN) {
      // Not enough room below — flip above the trigger, then clamp.
      top = Math.max(MARGIN, a.top - m.height - 6)
    }

    let left = align === 'right' ? a.right - m.width : a.left
    left = Math.min(Math.max(MARGIN, left), window.innerWidth - m.width - MARGIN)

    setPos({ top, left })
  }, [align])

  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    place()
  }, [open, place])

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
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={label}
            style={{
              top: pos?.top ?? 0,
              left: pos?.left ?? 0,
              // Keep it out of sight until measured, so it never flashes at 0,0.
              visibility: pos ? 'visible' : 'hidden',
            }}
            className="anim-scale-in fixed z-50 min-w-44 rounded-xl border border-neutral-200/80 bg-white p-1 shadow-lg shadow-neutral-900/10 dark:border-neutral-700/60 dark:bg-neutral-900 dark:shadow-black/50"
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
      className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors ${
        danger
          ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40'
          : active
            ? 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100'
            : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
      }`}
    >
      {icon && <span className="shrink-0 text-neutral-400 dark:text-neutral-500">{icon}</span>}
      <span className="flex-1">{children}</span>
    </button>
  )
}

export function MenuDivider() {
  return <div className="mx-1 my-1 h-px bg-neutral-200/70 dark:bg-neutral-700/60" />
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-2.5 pt-1.5 pb-1 text-[11px] font-medium tracking-wide text-neutral-400 uppercase dark:text-neutral-500">
      {children}
    </div>
  )
}
