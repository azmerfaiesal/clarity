import { Menu, Search, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BrainDump as Note } from '../types'
import { useNotes } from '../store/noteStore'
import { formatDateTime, formatRelative } from '../utils/dateUtils'
import { EMPTY_PRESETS, EmptyState } from './EmptyState'

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
 * The composer is the first thing on the page and holds focus, so the flow is
 * open, write, tag if you feel like it, save. Editing reuses the same composer
 * inline instead of opening a dialog, which keeps the writing surface constant.
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

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const composerRef = useRef<HTMLDivElement>(null)

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

  // Focus the sheet on arrival, but not on phones where it would throw up the
  // keyboard before the user has decided to write.
  useEffect(() => {
    if (window.matchMedia('(min-width: 768px)').matches) textareaRef.current?.focus()
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
      composerRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
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
      <header className="flex items-center gap-2 pt-6 pb-6 sm:pt-10">
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

      {/* Writing area */}
      <div
        ref={composerRef}
        className="anim-fade-in rounded-lg border border-line bg-raised shadow-sm shadow-black/5 dark:shadow-black/40"
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

        <div className="flex flex-wrap items-center gap-x-2 gap-y-2 border-t border-line px-3 py-2.5">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
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
            <input
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault()
                  commitTag(tagDraft)
                } else if (e.key === 'Backspace' && !tagDraft && tags.length) {
                  setTags((prev) => prev.slice(0, -1))
                  setDirty(true)
                }
              }}
              onBlur={() => commitTag(tagDraft)}
              placeholder={tags.length ? 'Add tag' : 'Add tags…'}
              aria-label="Add tag"
              className="min-w-24 flex-1 bg-transparent font-mono text-2xs text-ink outline-none placeholder:text-faint"
            />
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

      {/* History */}
      {notes.length > 0 && (
        <div className="mt-9">
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
                  className={`cursor-pointer rounded border px-1.5 py-0.5 font-mono text-3xs transition-colors ${
                    tagFilter === tag
                      ? 'border-accent/50 bg-accent-soft text-accent'
                      : 'border-line text-muted hover:text-ink'
                  }`}
                >
                  {tag} <span className="text-faint">{count}</span>
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
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-3xs">
                      <span className="text-faint">{formatDateTime(note.createdAt)}</span>
                      {wasEdited(note) && (
                        <span className="text-faint">· edited {formatRelative(note.updatedAt)}</span>
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
    </>
  )
}
