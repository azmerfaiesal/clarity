import { ArrowRight, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Task, TaskList } from '../types'
import { applySearch } from '../utils/taskUtils'

/** Global search / command palette (Cmd/Ctrl+K or "/"). */
export function SearchPalette({
  tasks,
  lists,
  open,
  onClose,
  onSelect,
}: {
  tasks: Task[]
  lists: TaskList[]
  open: boolean
  onClose: () => void
  onSelect: (task: Task) => void
}) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(
    () => applySearch(tasks, query, lists).slice(0, 12),
    [tasks, query, lists],
  )

  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIndex(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  useEffect(() => setActiveIndex(0), [query])

  // Escape closes the palette wherever focus happens to be, not only while the
  // search input holds it.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open, onClose])

  if (!open) return null

  const listName = (id: string | null) => lists.find((l) => l.id === id)?.name ?? 'Inbox'

  return (
    <div
      className="anim-fade-in fixed inset-0 z-50 flex items-start justify-center bg-[var(--scrim)] px-4 pt-[12vh] backdrop-blur-[3px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search tasks"
        className="anim-scale-in glow w-full max-w-xl overflow-hidden rounded-xl border border-line bg-raised shadow-2xl shadow-black/20 dark:shadow-black/70"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-line px-3.5">
          <Search className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActiveIndex((i) => Math.min(i + 1, results.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActiveIndex((i) => Math.max(i - 1, 0))
              } else if (e.key === 'Enter' && results[activeIndex]) {
                e.preventDefault()
                onSelect(results[activeIndex])
                onClose()
              }
            }}
            placeholder="Search tasks, lists, tags…"
            aria-label="Search tasks"
            className="w-full bg-transparent py-2.5 text-sm text-ink outline-none placeholder:text-faint"
          />
          <kbd className="rounded border border-line px-1.5 py-0.5 font-mono text-[9px] text-faint">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-1" role="listbox" aria-label="Search results">
          {query.trim() === '' ? (
            <p className="px-3 py-6 text-center text-xs text-muted">
              Type to search across all your tasks.
            </p>
          ) : results.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted">
              No results for “{query}”.
            </p>
          ) : (
            results.map((t, i) => (
              <button
                key={t.id}
                type="button"
                role="option"
                aria-selected={i === activeIndex}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => {
                  onSelect(t)
                  onClose()
                }}
                className={`flex w-full cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors ${
                  i === activeIndex ? 'bg-accent-soft' : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div
                    className={`truncate text-base text-ink ${
                      t.completed ? 'line-through opacity-55' : ''
                    }`}
                  >
                    {t.title}
                  </div>
                  {t.description && (
                    <div className="truncate text-xs text-muted">
                      {t.description}
                    </div>
                  )}
                </div>
                <span className="shrink-0 rounded border border-line px-2 py-0.5 font-mono text-3xs text-muted">
                  {listName(t.listId)}
                </span>
                {i === activeIndex && (
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
