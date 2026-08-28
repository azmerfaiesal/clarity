import { ArrowRight, CheckSquare, NotebookPen, Search, X } from 'lucide-react'
import { useMemo, useState, type RefObject } from 'react'
import type { BrainDump as Note, Task, TaskList } from '../types'
import { applySearch } from '../utils/taskUtils'
import { formatDateTime } from '../utils/dateUtils'

/**
 * The one search box, docked to the foot of every page.
 *
 * It replaces the old command palette, which had two problems: it was a modal
 * you had to know a keystroke to summon, and it only ever knew about tasks. A
 * note you had written was unfindable from anywhere except the Notes page's own
 * filter. This bar is always on screen, on every view, and searches both.
 *
 * It is a flex child at the bottom of the main column rather than a `fixed`
 * overlay, so it is genuinely docked: it never covers the page's last row, and
 * it never strays over the sidebar.
 */

/** How many of each kind to show. Enough to choose from, few enough to scan. */
const PER_KIND = 6

function preview(content: string): string {
  return content.replace(/\s+/g, ' ').trim()
}

function matchesNote(note: Note, q: string): boolean {
  return note.content.toLowerCase().includes(q) || note.tags.some((t) => t.includes(q))
}

/** One flat list, so the arrow keys can walk tasks and notes as a single run. */
type Hit = { kind: 'task'; task: Task } | { kind: 'note'; note: Note }

export function GlobalSearch({
  tasks,
  lists,
  notes,
  inputRef,
  onSelectTask,
  onSelectNote,
}: {
  tasks: Task[]
  lists: TaskList[]
  notes: Note[]
  /** Held by App so `/`, ⌘K and the header button can put the caret here. */
  inputRef: RefObject<HTMLInputElement | null>
  onSelectTask: (task: Task) => void
  onSelectNote: (note: Note) => void
}) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  // Escape hides the results without discarding what was typed; typing again
  // brings them back. Blur does not — a click on a result blurs the field.
  const [dismissed, setDismissed] = useState(false)

  const hits = useMemo<Hit[]>(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const taskHits: Hit[] = applySearch(tasks, query, lists)
      .slice(0, PER_KIND)
      .map((task) => ({ kind: 'task', task }))
    const noteHits: Hit[] = notes
      .filter((n) => matchesNote(n, q))
      .slice(0, PER_KIND)
      .map((note) => ({ kind: 'note', note }))
    return [...taskHits, ...noteHits]
  }, [query, tasks, lists, notes])

  const open = query.trim() !== '' && !dismissed
  const firstNoteAt = hits.findIndex((h) => h.kind === 'note')

  const choose = (hit: Hit) => {
    if (hit.kind === 'task') onSelectTask(hit.task)
    else onSelectNote(hit.note)
    setQuery('')
    setDismissed(false)
    inputRef.current?.blur()
  }

  const listName = (id: string | null) => lists.find((l) => l.id === id)?.name ?? 'Inbox'

  return (
    // `backdrop-blur` makes this a stacking context, so the results panel's own
    // z-index cannot reach past it — the bar as a whole has to outrank the
    // mobile add-task button, or that button draws over the results.
    <div className="relative z-40 shrink-0 border-t border-line bg-bg/85 backdrop-blur-sm">
      {open && (
        <div
          className="anim-fade-slide-in absolute right-0 bottom-full left-0 z-40 px-4 pb-2 sm:px-6"
          role="listbox"
          aria-label="Search results"
        >
          <div className="mx-auto max-h-[52vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-line bg-raised p-1 shadow-xl shadow-black/15 dark:shadow-black/60">
            {hits.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted">
                Nothing in your tasks or notes matches “{query.trim()}”.
              </p>
            ) : (
              hits.map((hit, i) => {
                const selected = i === active
                return (
                  <div key={hit.kind === 'task' ? `t:${hit.task.id}` : `n:${hit.note.id}`}>
                    {/* Headers are drawn between the two runs rather than around
                        them, so the list stays one keyboard-navigable column. */}
                    {i === 0 && <GroupLabel icon={CheckSquare} text="Tasks" />}
                    {i === firstNoteAt && i !== 0 && <GroupLabel icon={NotebookPen} text="Notes" />}
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onMouseEnter={() => setActive(i)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => choose(hit)}
                      className={`flex w-full cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors ${
                        selected ? 'bg-accent-soft' : ''
                      }`}
                    >
                      {hit.kind === 'task' ? (
                        <>
                          <div className="min-w-0 flex-1">
                            <div
                              className={`truncate text-base text-ink ${
                                hit.task.completed ? 'line-through opacity-55' : ''
                              }`}
                            >
                              {hit.task.title}
                            </div>
                            {hit.task.description && (
                              <div className="truncate text-xs text-muted">
                                {hit.task.description}
                              </div>
                            )}
                          </div>
                          <span className="shrink-0 rounded border border-line px-2 py-0.5 font-mono text-3xs text-muted">
                            {listName(hit.task.listId)}
                          </span>
                        </>
                      ) : (
                        <div className="min-w-0 flex-1">
                          <div className="font-mono text-3xs text-accent">
                            {formatDateTime(hit.note.createdAt)}
                          </div>
                          <div className="truncate text-sm text-ink">
                            {preview(hit.note.content)}
                          </div>
                        </div>
                      )}
                      {selected && (
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
                      )}
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-2xl px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 transition-colors focus-within:border-accent">
          <Search className="h-4 w-4 shrink-0 text-faint" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setDismissed(false)
              // Reset here rather than in an effect on `query`: a new search is
              // the event that invalidates the highlight, and doing it in the
              // handler saves the extra render an effect would cost.
              setActive(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((i) => Math.min(i + 1, hits.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((i) => Math.max(i - 1, 0))
              } else if (e.key === 'Enter' && open && hits[active]) {
                e.preventDefault()
                choose(hits[active])
              } else if (e.key === 'Escape') {
                // Kept local: the page behind should not also react to it.
                e.stopPropagation()
                if (open) setDismissed(true)
                else {
                  setQuery('')
                  inputRef.current?.blur()
                }
              }
            }}
            placeholder="Search tasks and notes…"
            aria-label="Search tasks and notes"
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            // The wrapper already lights up on focus. Without suppressing the
            // global focus ring as well, the field draws a second accent
            // rectangle just inside the first — two borders where one is meant.
            className="no-focus-ring w-full bg-transparent text-sm text-ink outline-none placeholder:text-faint"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setDismissed(false)
                inputRef.current?.focus()
              }}
              aria-label="Clear search"
              className="shrink-0 cursor-pointer text-faint transition-colors hover:text-ink"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <kbd className="hidden shrink-0 rounded border border-line px-1.5 py-0.5 font-mono text-3xs text-faint sm:block">
              /
            </kbd>
          )}
        </div>
      </div>
    </div>
  )
}

function GroupLabel({
  icon: Icon,
  text,
}: {
  icon: typeof CheckSquare
  text: string
}) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 pt-2 pb-1 first:pt-1">
      <Icon className="h-3 w-3 text-faint" aria-hidden />
      <span className="label">{text}</span>
    </div>
  )
}
