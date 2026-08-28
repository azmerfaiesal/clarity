import { Menu, Search, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BrainDump as Note, Habit } from '../types'
import { useNotes } from '../store/noteStore'
import { useHabits } from '../store/habitStore'
import { HabitHeatmap, HabitMonthRows } from './HabitHeatmap'
import { FlameIcon } from './FlameIcon'
import { NoteDayDetail } from './NoteDayDetail'
import { formatDateTime, formatRelative, todayStr } from '../utils/dateUtils'
import { habitStats } from '../utils/habitUtils'
import { useWeekStart } from '../store/theme'
import { EMPTY_PRESETS, EmptyState } from './EmptyState'

/**
 * Stats are derived, so they need a habit even when there is not one yet. This
 * stands in for the writing habit until it is created, and reads as zero.
 */
const EMPTY_HABIT: Habit = {
  id: '',
  name: 'Writing',
  description: '',
  repetitionType: 'daily',
  daysOfWeek: [],
  datesOfMonth: [],
  timesPerWeek: null,
  trackBy: 'checkoff',
  dailyTarget: null,
  color: '#c084fc',
  icon: '',
  targetStreak: null,
  reminderTime: null,
  createdAt: new Date(0).toISOString(),
  logs: {},
  logNotes: {},
  lastCompleted: null,
  archivedAt: null,
  sortOrder: 0,
  source: 'notes',
}

/** A note counts as edited once its stamps drift apart by more than a second. */
function wasEdited(note: Note): boolean {
  return new Date(note.updatedAt).getTime() - new Date(note.createdAt).getTime() > 1000
}

/**
 * Flatten a note for its list preview. The stored text keeps every line break —
 * this only affects the two-line summary, where blank lines would otherwise eat
 * the whole preview.
 */
function preview(content: string): string {
  return content.replace(/\s+/g, ' ').trim()
}

function normalizeTag(raw: string): string {
  return raw.trim().replace(/^#/, '').toLowerCase()
}

/**
 * Brain Dump — a blank sheet rather than a form.
 *
 * The composer sits at the foot of the page, under what has already been
 * written, so the flow is read back, then add. Editing reuses that same
 * composer inline instead of opening a dialog, which keeps the writing surface
 * constant — picking a note scrolls down to it.
 */
export function BrainDump({
  onOpenMobileNav,
  tagFilter,
  onTagFilter,
}: {
  onOpenMobileNav: () => void
  /** Owned by App so the sidebar's tag list can drive it. */
  tagFilter: string | null
  onTagFilter: (tag: string | null) => void
}) {
  const { notes, saveState, createNote, updateNote, deleteNote, readDraft, writeDraft, discardDraft } =
    useNotes()

  const [content, setContent] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagDraft, setTagDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [query, setQuery] = useState('')
  // Escape hides the list without clearing what has been typed; anything typed
  // afterwards brings it back. Simpler than tracking focus, and it behaves the
  // same way, since typing is the only thing that fills the field.
  const [suggestDismissed, setSuggestDismissed] = useState(false)
  // The writing habit and its grid live here now rather than under Habits: it
  // is a picture of these notes, so this is where it belongs.
  const { habits, addWritingHabit } = useHabits()
  const writing = habits.find((h) => h.source === 'notes' && h.archivedAt === null)
  const [writingRange, setWritingRange] = useState<'month' | 'year'>('month')
  const [day, setDay] = useState<{ date: string; anchor: { x: number; y: number } } | null>(null)
  const firstDay = useWeekStart()
  const writingStats = useMemo(
    () => habitStats(writing ?? EMPTY_HABIT, todayStr(), firstDay),
    [writing, firstDay],
  )
  const [highlight, setHighlight] = useState(0)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const composerRef = useRef<HTMLDivElement>(null)
  const tagRef = useRef<HTMLInputElement>(null)
  // Set for the moment between mousedown on a suggestion and its click, so the
  // input's blur handler knows not to commit the half-typed draft underneath.
  const pickingRef = useRef(false)

  const editing = editingId ? notes.find((n) => n.id === editingId) : undefined

  // Recover anything left in the composer by a previous session.
  useEffect(() => {
    const draft = readDraft()
    if (draft && (draft.content.trim() || draft.tags.length)) {
      setContent(draft.content)
      setTags(draft.tags)
      setDirty(true)
    }
    // Only on mount — later reads would fight the user's typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Grow the textarea with its content instead of scrolling inside a fixed box.
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(el.scrollHeight, 160)}px`
  }, [content])

  // Persist the in-progress note so a refresh mid-thought loses nothing.
  useEffect(() => {
    if (editingId) return
    if (dirty) writeDraft({ content, tags })
  }, [content, tags, dirty, editingId, writeDraft])

  const reset = useCallback(() => {
    setContent('')
    setTags([])
    setTagDraft('')
    setSuggestDismissed(false)
    setHighlight(0)
    setEditingId(null)
    setDirty(false)
    discardDraft()
  }, [discardDraft])

  const commitTag = useCallback(
    (raw: string) => {
      const tag = normalizeTag(raw)
      if (!tag) return
      setTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]))
      setTagDraft('')
      setDirty(true)
    },
    [],
  )

  const save = useCallback(async () => {
    // A trailing tag still in the input counts as typed, not lost.
    const pending = normalizeTag(tagDraft)
    const finalTags = pending && !tags.includes(pending) ? [...tags, pending] : tags
    const body = content.trim()
    if (!body) return
    if (editingId) {
      await updateNote(editingId, { content: body, tags: finalTags })
    } else {
      await createNote(body, finalTags)
    }
    reset()
    textareaRef.current?.focus()
  }, [content, tags, tagDraft, editingId, updateNote, createNote, reset])

  const openForEdit = useCallback(
    (note: Note) => {
      if (dirty && !window.confirm('Discard the note you are writing?')) return
      discardDraft()
      setEditingId(note.id)
      setContent(note.content)
      setTags(note.tags)
      setTagDraft('')
      setDirty(false)
      composerRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      window.setTimeout(() => textareaRef.current?.focus(), 60)
    },
    [dirty, discardDraft],
  )

  const remove = useCallback(
    async (note: Note) => {
      const preview = note.content.trim().split('\n')[0].slice(0, 60)
      if (!window.confirm(`Delete this brain dump?\n\n“${preview}”\n\nThis cannot be undone.`)) return
      if (editingId === note.id) reset()
      await deleteNote(note.id)
    },
    [deleteNote, editingId, reset],
  )

  // Esc cancels an edit; it never clears a new note in progress.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // The tag suggestions want Escape first — dismissing a list you can see
      // should not also throw away the edit behind it. This listener is on the
      // capture phase, so it has to check rather than wait to be stopped.
      if (document.getElementById('tag-suggestions')) return
      if (editingId) {
        e.stopPropagation()
        reset()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [editingId, reset])

  const allTags = useMemo(() => {
    const counts = new Map<string, number>()
    for (const n of notes) for (const t of n.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [notes])

  /**
   * Tags already in use that match what is being typed, best first.
   *
   * Prefix matches come before matches from the middle of a word — typing "cl"
   * should offer "clarity" ahead of "spending log" even if that were a match —
   * and within each group the tag used most often wins. Tags already on this
   * note are left out: offering one you cannot add is just noise.
   */
  const suggestions = useMemo(() => {
    if (suggestDismissed) return []
    const q = normalizeTag(tagDraft)
    if (!q) return []
    const scored = allTags
      .filter(([tag]) => !tags.includes(tag) && tag !== q && tag.includes(q))
      .sort((a, b) => {
        const byPrefix = Number(b[0].startsWith(q)) - Number(a[0].startsWith(q))
        return byPrefix || b[1] - a[1] || a[0].localeCompare(b[0])
      })
    return scored.slice(0, 6)
  }, [allTags, tagDraft, tags, suggestDismissed])

  const onTagKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const open = suggestions.length > 0
      if (open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault()
        const step = e.key === 'ArrowDown' ? 1 : -1
        setHighlight((h) => (h + step + suggestions.length) % suggestions.length)
        return
      }
      if (e.key === 'Escape' && open) {
        // Dismiss the list without giving up what has been typed so far.
        e.preventDefault()
        e.stopPropagation()
        setSuggestDismissed(true)
        return
      }
      if (e.key === 'Enter' || e.key === ',' || (e.key === 'Tab' && open)) {
        // Tab only means "take the suggestion"; with the list closed it should
        // still move on to the next control.
        if (e.key === 'Tab' && !open) return
        e.preventDefault()
        commitTag(open ? suggestions[highlight][0] : tagDraft)
        setHighlight(0)
        return
      }
      if (e.key === 'Backspace' && !tagDraft && tags.length) {
        setTags((prev) => prev.slice(0, -1))
        setDirty(true)
      }
    },
    [suggestions, highlight, tagDraft, tags, commitTag],
  )

  const byDay = useMemo(() => {
    const map = new Map<string, Note[]>()
    for (const n of notes) {
      const key = n.createdAt.slice(0, 10)
      const list = map.get(key)
      if (list) list.push(n)
      else map.set(key, [n])
    }
    return map
  }, [notes])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return notes.filter((n) => {
      if (tagFilter && !n.tags.includes(tagFilter)) return false
      if (!q) return true
      return n.content.toLowerCase().includes(q) || n.tags.some((t) => t.includes(q))
    })
  }, [notes, query, tagFilter])

  const filtering = query.trim() !== '' || tagFilter !== null
  const canSave = content.trim() !== ''

  const status =
    saveState === 'saving'
      ? 'Saving…'
      : saveState === 'error'
        ? 'Not saved'
        : dirty && canSave
          ? 'Unsaved'
          : saveState === 'saved'
            ? 'Saved'
            : ''

  return (
    <>
      <header className="flex items-center gap-2 pt-6 pb-4 sm:pt-10">
        <button
          type="button"
          onClick={onOpenMobileNav}
          aria-label="Open navigation"
          className="-ml-1 cursor-pointer rounded-md p-2 text-muted transition-colors hover:bg-surface hover:text-ink md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold tracking-[-0.02em] text-ink sm:text-2xl">
            Notes
          </h1>
          <p className="mt-1 font-mono text-2xs tracking-[0.06em] text-faint uppercase">
            {notes.length} {notes.length === 1 ? 'note' : 'notes'}
          </p>
        </div>
      </header>

      {/* Writing streak. A picture of the notes below it, so it reads as part
          of this page rather than a habit that happens to mention them. */}
      {writing ? (
        <section className="mb-8 rounded-lg border border-line bg-raised px-4 py-3.5">
          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="label">Writing streak</span>
            <span className="flex items-center gap-1.5">
              <FlameIcon
                className="h-3.5 w-3.5"
                beaming={writingStats.current > 0}
                color={writing.color}
                streak={writingStats.current}
                peak={writing.targetStreak ?? 30}
              />
              <span
                className="font-mono text-sm font-semibold tabular-nums"
                style={{ color: writing.color }}
              >
                {writingStats.current}
              </span>
              <span className="text-3xs text-faint">
                day{writingStats.current === 1 ? '' : 's'}
              </span>
            </span>
            <div
              role="radiogroup"
              aria-label="Writing history range"
              className="ml-auto inline-flex rounded-md border border-line p-0.5"
            >
              {(
                [
                  ['month', 'This month'],
                  ['year', 'Last 365 days'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={writingRange === value}
                  onClick={() => setWritingRange(value)}
                  className={`cursor-pointer rounded px-1.5 py-0.5 font-mono text-3xs transition-colors ${
                    writingRange === value ? 'bg-accent-soft text-ink' : 'text-faint hover:text-ink'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {writingRange === 'year' ? (
            <HabitHeatmap
              habit={writing}
              onPickDay={(date, anchor) => setDay({ date, anchor })}
            />
          ) : (
            <HabitMonthRows
              habit={writing}
              span="month"
              onPickDay={(date, anchor) => setDay({ date, anchor })}
            />
          )}
          <p className="mt-2 font-mono text-3xs text-faint">
            {writingStats.total} day{writingStats.total === 1 ? '' : 's'} written ·{' '}
            {writingStats.best} best streak
          </p>
        </section>
      ) : (
        <div className="mb-8">
          <button
            type="button"
            onClick={addWritingHabit}
            title="Tracks a streak of the days you write something"
            className="cursor-pointer rounded-md border border-dashed border-line px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent/50 hover:text-ink"
          >
            + Track a writing streak
          </button>
        </div>
      )}

      {day && (
        <NoteDayDetail
          date={day.date}
          notes={byDay.get(day.date) ?? []}
          anchor={day.anchor}
          onOpenNote={(note) => {
            setDay(null)
            openForEdit(note)
          }}
          onClose={() => setDay(null)}
        />
      )}

      {/* History */}
      {notes.length > 0 && (
        <div className="mt-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="label shrink-0">Earlier</span>
            <div className="ml-auto flex min-w-0 items-center gap-1.5 rounded-md border border-line px-2 py-1 focus-within:border-accent">
              <Search className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search notes"
                aria-label="Search brain dumps"
                className="w-28 bg-transparent text-xs text-ink outline-none placeholder:text-faint sm:w-44"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  className="shrink-0 cursor-pointer text-faint transition-colors hover:text-ink"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {allTags.length > 0 && (
            <div className="mb-1 flex flex-wrap gap-1.5" role="group" aria-label="Filter by tag">
              {allTags.map(([tag, count]) => (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={tagFilter === tag}
                  onClick={() => onTagFilter(tagFilter === tag ? null : tag)}
                  // Accent throughout, because every chip here is a control.
                  // The picked one fills; the rest are outlined in the same hue,
                  // so the row reads as one set with one member switched on
                  // rather than as grey furniture next to a coloured thing.
                  className={`cursor-pointer rounded border px-1.5 py-0.5 font-mono text-3xs transition-colors ${
                    tagFilter === tag
                      ? 'border-accent bg-accent text-accent-ink'
                      : 'border-accent/30 text-accent/80 hover:border-accent/60 hover:bg-accent-soft hover:text-accent'
                  }`}
                >
                  {tag}{' '}
                  <span className={tagFilter === tag ? 'text-accent-ink/70' : 'text-accent/50'}>
                    {count}
                  </span>
                </button>
              ))}
            </div>
          )}

          {visible.length === 0 ? (
            <EmptyState {...EMPTY_PRESETS.search} />
          ) : (
            <ul className="mt-1" role="list">
              {visible.map((note) => (
                <li key={note.id} className="group relative border-b border-line last:border-b-0">
                  <button
                    type="button"
                    onClick={() => openForEdit(note)}
                    className={`w-full cursor-pointer py-3 pr-9 text-left transition-colors ${
                      editingId === note.id ? 'opacity-50' : ''
                    }`}
                  >
                    {/* The stamp carries the accent: it is the one line that
                        dates the note, and in faint grey it disappeared into
                        the rules between rows. */}
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-3xs">
                      <span className="text-accent">{formatDateTime(note.createdAt)}</span>
                      {wasEdited(note) && (
                        <span className="text-accent/70">
                          · edited {formatRelative(note.updatedAt)}
                        </span>
                      )}
                      {note.tags.map((tag) => (
                        <span key={tag} className="rounded border border-line px-1.5 py-px text-muted">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm text-ink">{preview(note.content)}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(note)}
                    aria-label="Delete brain dump"
                    className="absolute top-3 right-0 cursor-pointer rounded p-1.5 text-faint opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:text-danger"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {notes.length === 0 && !filtering && (
        <EmptyState {...EMPTY_PRESETS.braindump} />
      )}

      {/* Writing area */}
      <div
        ref={composerRef}
        className="anim-fade-in mt-8 rounded-lg border border-line bg-raised shadow-sm shadow-black/5 dark:shadow-black/40"
      >
        {editing && (
          <div className="flex items-center gap-2 border-b border-line px-3 py-2 font-mono text-2xs text-faint">
            <span className="truncate">Editing · {formatDateTime(editing.createdAt)}</span>
            <button
              type="button"
              onClick={reset}
              className="ml-auto shrink-0 cursor-pointer rounded px-1.5 py-0.5 font-sans text-xs font-medium text-muted transition-colors hover:bg-surface hover:text-ink"
            >
              Cancel
            </button>
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => {
            setContent(e.target.value)
            setDirty(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              void save()
            }
          }}
          placeholder="What's on your mind?"
          aria-label="Brain dump"
          rows={6}
          className="block max-h-[60vh] w-full resize-none bg-transparent px-4 py-3.5 text-base leading-relaxed text-ink outline-none placeholder:text-faint"
        />

        <div className="border-t border-line px-3 py-2.5">
          {tags.length > 0 && (
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded border border-line px-1.5 py-0.5 font-mono text-3xs text-muted"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => {
                      setTags((prev) => prev.filter((t) => t !== tag))
                      setDirty(true)
                    }}
                    aria-label={`Remove tag ${tag}`}
                    className="cursor-pointer text-faint transition-colors hover:text-danger"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* The field gets a row of its own. Sharing one with the chips meant
              it was whatever sliver of space they left over, in a position that
              moved every time a tag was added — which is where the caret kept
              turning up somewhere unexpected. */}
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <input
                ref={tagRef}
                value={tagDraft}
                onChange={(e) => {
                  setTagDraft(e.target.value)
                  setSuggestDismissed(false)
                  setHighlight(0)
                }}
                onKeyDown={onTagKeyDown}
                onBlur={() => {
                  // A click on a suggestion blurs first; that path commits the
                  // suggestion itself, so there is nothing to do here.
                  if (pickingRef.current) return
                  setSuggestDismissed(true)
                  commitTag(tagDraft)
                }}
                onFocus={() => setSuggestDismissed(false)}
                placeholder={tags.length ? 'Add tag' : 'Add tags…'}
                aria-label="Add tag"
                role="combobox"
                aria-expanded={suggestions.length > 0}
                aria-controls="tag-suggestions"
                aria-autocomplete="list"
                className="w-full bg-transparent py-1 font-mono text-2xs text-ink outline-none placeholder:text-faint"
              />

              {suggestions.length > 0 && (
                <ul
                  id="tag-suggestions"
                  role="listbox"
                  aria-label="Matching tags"
                  className="anim-fade-in absolute bottom-full left-0 z-20 mb-1 max-h-44 w-44 overflow-y-auto rounded-lg border border-line bg-raised py-1 shadow-xl shadow-black/15 dark:shadow-black/60"
                >
                  {suggestions.map(([tag, count], i) => (
                    <li key={tag}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={i === highlight}
                        // Keep focus in the field so blur cannot commit the
                        // half-typed draft before the click lands.
                        onMouseDown={() => {
                          pickingRef.current = true
                        }}
                        onClick={() => {
                          commitTag(tag)
                          pickingRef.current = false
                          tagRef.current?.focus()
                        }}
                        onMouseEnter={() => setHighlight(i)}
                        className={`flex w-full cursor-pointer items-center gap-2 px-2.5 py-1.5 text-left font-mono text-2xs transition-colors ${
                          i === highlight ? 'bg-accent-soft text-ink' : 'text-muted'
                        }`}
                      >
                        <span className="min-w-0 flex-1 truncate">{tag}</span>
                        <span className="shrink-0 text-3xs text-faint tabular-nums">{count}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <span
              aria-live="polite"
              className="shrink-0 font-mono text-3xs text-faint tabular-nums"
            >
              {status}
            </span>
            <button
              type="button"
              onClick={() => void save()}
              disabled={!canSave}
              className="shrink-0 cursor-pointer rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-ink transition-all hover:bg-accent-hi hover:glow-sm disabled:cursor-not-allowed disabled:opacity-40"
            >
              {editingId ? 'Save changes' : 'Save'}
            </button>
          </div>
        </div>
      </div>

    </>
  )
}
