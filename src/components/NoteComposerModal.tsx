import { LayoutTemplate, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useNotes } from '../store/noteStore'
import type { NoteTemplate } from '../store/noteTemplates'
import { usePresenceValue } from './MotionPresence'
import { NoteTemplates } from './NoteTemplates'
import { useComposerAnchor } from './useComposerAnchor'

const NOTE_AUTOSAVE_IDLE_MS = 5_000

function normalizeTags(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(',')
        .map((tag) => tag.trim().replace(/^#/, '').toLowerCase())
        .filter(Boolean),
    ),
  ]
}

export function NoteComposerModal({
  open,
  anchorRef,
  onCreated,
  onClose,
}: {
  open: boolean
  anchorRef: RefObject<HTMLElement | null>
  onCreated: (noteId: string) => void
  onClose: () => void
}) {
  const { saveState, createNote, updateNote, readDraft, writeDraft, discardDraft } = useNotes()
  const [content, setContent] = useState('')
  const [tagDraft, setTagDraft] = useState('')
  const [dirty, setDirty] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const activeNoteIdRef = useRef<string | null>(null)
  const changeVersionRef = useRef(0)
  const autosaveTimerRef = useRef<number | null>(null)
  const autosaveInFlightRef = useRef<Promise<string | null> | null>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const presence = usePresenceValue(open ? true : null, {
    onExited: () => anchorRef.current?.focus(),
  })
  const templatesPresence = usePresenceValue(templatesOpen ? true : null)
  useComposerAnchor(anchorRef, dialogRef, open)

  useEffect(() => {
    if (!open || content || tagDraft) return
    const draft = readDraft()
    if (!draft) return
    setContent(draft.content)
    setTagDraft(draft.tags.join(', '))
    setDirty(Boolean(draft.content.trim() || draft.tags.length))
  }, [content, open, readDraft, tagDraft])

  const clearAutosave = useCallback(() => {
    if (autosaveTimerRef.current === null) return
    window.clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = null
  }, [])

  const persist = useCallback(async () => {
    const body = content.trim()
    if (!body) return null
    const tags = normalizeTags(tagDraft)
    const version = changeVersionRef.current
    const run = async () => {
      if (activeNoteIdRef.current) {
        await updateNote(activeNoteIdRef.current, { content: body, tags })
        return activeNoteIdRef.current
      }
      const note = await createNote(body, tags)
      activeNoteIdRef.current = note.id
      discardDraft()
      return note.id
    }
    const previous = autosaveInFlightRef.current
    const operation = (previous ? previous.catch(() => null) : Promise.resolve(null)).then(run)
    autosaveInFlightRef.current = operation
    const id = await operation
    if (autosaveInFlightRef.current === operation) autosaveInFlightRef.current = null
    if (changeVersionRef.current === version) setDirty(false)
    return id
  }, [content, createNote, discardDraft, tagDraft, updateNote])

  useEffect(() => {
    clearAutosave()
    if (!open || !dirty || !content.trim()) return
    writeDraft({ content, tags: normalizeTags(tagDraft) })
    autosaveTimerRef.current = window.setTimeout(() => {
      autosaveTimerRef.current = null
      void persist()
    }, NOTE_AUTOSAVE_IDLE_MS)
    return clearAutosave
  }, [clearAutosave, content, dirty, open, persist, tagDraft, writeDraft])

  useEffect(() => {
    if (!open) clearAutosave()
  }, [clearAutosave, open])

  const close = useCallback(() => {
    clearAutosave()
    setTemplatesOpen(false)
    // An idle autosave turns this session into an existing note. Closing that
    // completed session must make the next global "New note" action genuinely
    // blank, while a not-yet-autosaved draft remains intact for recovery.
    if (activeNoteIdRef.current && !dirty) {
      setContent('')
      setTagDraft('')
      activeNoteIdRef.current = null
      changeVersionRef.current = 0
      discardDraft()
    }
    onClose()
  }, [clearAutosave, dirty, discardDraft, onClose])

  if (!presence) return null
  const interactive = presence.phase !== 'exiting'

  const save = async () => {
    if (!interactive || !content.trim()) return
    clearAutosave()
    const id = await persist()
    if (!id) return
    setContent('')
    setTagDraft('')
    setDirty(false)
    activeNoteIdRef.current = null
    discardDraft()
    onCreated(id)
  }

  const applyTemplate = (template: NoteTemplate) => {
    const prefix = content.trim() ? `${content.replace(/\s+$/, '')}\n\n` : ''
    setContent(prefix + template.body)
    const tags = normalizeTags(tagDraft)
    setTagDraft([...new Set([...tags, ...template.tags])].join(', '))
    changeVersionRef.current += 1
    setDirty(true)
    setTemplatesOpen(false)
    window.setTimeout(() => textareaRef.current?.focus(), 0)
  }

  return createPortal(
    <>
      <div
        data-motion-state={presence.phase}
        className="native-modal-viewport motion-overlay fixed inset-0 z-50"
        onClick={(event) => {
          if (event.target === event.currentTarget && interactive) close()
        }}
      >
        <section
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="New note"
          inert={!interactive}
          className="note-composer-modal anchored-composer-modal motion-dialog"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && !event.defaultPrevented) {
              event.preventDefault()
              close()
            }
          }}
        >
          <header className="flex items-center justify-between border-b border-line px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-ink">New note</h2>
              <p className="mt-0.5 font-mono text-3xs text-faint">Autosaves after 5 seconds</p>
            </div>
            <button
              type="button"
              aria-label="Close note composer"
              onClick={close}
              className="motion-interactive rounded-md p-2 text-faint hover:bg-surface hover:text-ink"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </header>

          <textarea
            ref={textareaRef}
            autoFocus={interactive}
            value={content}
            onChange={(event) => {
              setContent(event.target.value)
              changeVersionRef.current += 1
              setDirty(true)
            }}
            aria-label="Note content"
            placeholder="What's on your mind?"
            rows={8}
            className="block min-h-48 w-full resize-none bg-transparent px-4 py-4 text-base leading-relaxed text-ink outline-none placeholder:text-faint"
          />

          <div className="border-t border-line px-4 py-3">
            <label className="block">
              <span className="label">Tags</span>
              <input
                value={tagDraft}
                onChange={(event) => {
                  setTagDraft(event.target.value)
                  changeVersionRef.current += 1
                  setDirty(true)
                }}
                aria-label="Add note tags"
                placeholder="clarity, ideas"
                className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 font-mono text-xs text-ink outline-none focus:border-accent"
              />
            </label>
          </div>

          <footer className="flex items-center gap-2 border-t border-line px-4 py-3">
            <button
              type="button"
              onClick={() => setTemplatesOpen(true)}
              className="motion-interactive inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-2 text-xs font-medium text-muted hover:border-accent/50 hover:text-ink"
            >
              <LayoutTemplate className="h-3.5 w-3.5" aria-hidden />
              Templates
            </button>
            <span className="ml-auto font-mono text-3xs text-faint" aria-live="polite">
              {saveState === 'saving'
                ? 'Saving…'
                : saveState === 'error'
                  ? 'Not saved'
                  : dirty
                    ? 'Unsaved'
                    : saveState === 'saved'
                      ? 'Saved'
                      : ''}
            </span>
            <button
              type="button"
              onClick={() => void save()}
              disabled={!content.trim()}
              aria-label="Save note"
              className="motion-primary motion-interactive rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink hover:bg-accent-hi disabled:opacity-40"
            >
              Save
            </button>
          </footer>
        </section>
      </div>

      {templatesPresence && (
        <NoteTemplates
          hasContent={Boolean(content.trim())}
          onPick={applyTemplate}
          onClose={() => setTemplatesOpen(false)}
          phase={templatesPresence.phase}
        />
      )}
    </>,
    document.body,
  )
}
