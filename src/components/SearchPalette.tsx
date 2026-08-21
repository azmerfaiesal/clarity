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

  if (!open) return null

  const listName = (id: string | null) => lists.find((l) => l.id === id)?.name ?? 'Inbox'

  return (
    <div
      className="anim-fade-in fixed inset-0 z-50 flex items-start justify-center bg-neutral-950/30 px-4 pt-[12vh] backdrop-blur-[2px] dark:bg-black/50"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search tasks"
        className="anim-scale-in w-full max-w-xl overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-700 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-neutral-100 px-4 dark:border-neutral-800">
          <Search className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
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
              } else if (e.key === 'Escape') {
                onClose()
              }
            }}
            placeholder="Search tasks, lists, tags…"
            aria-label="Search tasks"
            className="w-full bg-transparent py-3.5 text-[15px] text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-neutral-100"
          />
          <kbd className="rounded-md border border-neutral-200 px-1.5 py-0.5 text-[10px] font-medium text-neutral-400 dark:border-neutral-700">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-1.5" role="listbox" aria-label="Search results">
          {query.trim() === '' ? (
            <p className="px-3 py-8 text-center text-[13px] text-neutral-400 dark:text-neutral-500">
              Type to search across all your tasks.
            </p>
          ) : results.length === 0 ? (
            <p className="px-3 py-8 text-center text-[13px] text-neutral-400 dark:text-neutral-500">
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
                className={`flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left ${
                  i === activeIndex
                    ? 'bg-neutral-100 dark:bg-neutral-800'
                    : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div
                    className={`truncate text-[14px] text-neutral-900 dark:text-neutral-100 ${
                      t.completed ? 'line-through opacity-60' : ''
                    }`}
                  >
                    {t.title}
                  </div>
                  {t.description && (
                    <div className="truncate text-[12px] text-neutral-400 dark:text-neutral-500">
                      {t.description}
                    </div>
                  )}
                </div>
                <span className="shrink-0 rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                  {listName(t.listId)}
                </span>
                {i === activeIndex && (
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden />
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
