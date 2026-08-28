import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { BrainDump as Note } from '../types'
import { parseDate } from '../utils/dateUtils'

/** Four to a page: enough to recognise a day, few enough to stay a popover. */
const PER_PAGE = 4

/**
 * What was written on one day, opened from the writing grid.
 *
 * The habit version of this popup reports streaks and lets you annotate a log;
 * neither applies here, because a writing day is not something you tick — it
 * is the notes themselves. So this lists them, and hands you to the one you
 * pick.
 */
export function NoteDayDetail({
  date,
  notes,
  anchor,
  onOpenNote,
  onClose,
}: {
  date: string
  /** Notes written on this date, newest first. */
  notes: Note[]
  anchor: { x: number; y: number }
  onOpenNote: (note: Note) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const [page, setPage] = useState(0)

  const pages = Math.max(1, Math.ceil(notes.length / PER_PAGE))
  const shown = notes.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE)

  // Re-measure per page: pages hold different numbers of notes, so the box
  // changes height and would otherwise drift off its cell.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const margin = 8
    setPos({
      left: Math.min(Math.max(margin, anchor.x - r.width / 2), window.innerWidth - r.width - margin),
      top: anchor.y - r.height - 10 < margin ? anchor.y + 18 : anchor.y - r.height - 10,
    })
  }, [anchor, page, notes.length])

  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [onClose])

  const heading = parseDate(date).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`Notes written on ${date}`}
      style={{
        left: pos?.left ?? 0,
        top: pos?.top ?? 0,
        visibility: pos ? 'visible' : 'hidden',
      }}
      className="anim-scale-in fixed z-50 w-64 rounded-xl border border-line bg-raised p-3 shadow-2xl shadow-black/30 dark:shadow-black/70"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">{heading}</p>
          <p className="mt-0.5 text-xs text-faint">
            {notes.length === 0
              ? 'Nothing written'
              : `${notes.length} ${notes.length === 1 ? 'note' : 'notes'}`}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mt-0.5 -mr-1 shrink-0 cursor-pointer rounded p-1 text-faint transition-colors hover:text-ink"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {shown.length > 0 && (
        <ul className="mt-2 space-y-0.5 border-t border-line pt-2" role="list">
          {shown.map((note) => (
            <li key={note.id}>
              <button
                type="button"
                onClick={() => onOpenNote(note)}
                className="w-full cursor-pointer rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-surface"
              >
                <p className="line-clamp-2 text-xs leading-relaxed text-ink">
                  {note.content.replace(/\s+/g, ' ').trim()}
                </p>
                {note.tags.length > 0 && (
                  <p className="mt-0.5 truncate font-mono text-3xs text-faint">
                    {note.tags.join(' · ')}
                  </p>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            aria-label="Previous page"
            className="cursor-pointer rounded p-1 text-faint transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="font-mono text-3xs text-faint tabular-nums">
            {page + 1} / {pages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
            disabled={page === pages - 1}
            aria-label="Next page"
            className="cursor-pointer rounded p-1 text-faint transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
