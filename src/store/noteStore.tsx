import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { BrainDump } from '../types'
import { makeId } from '../utils/taskUtils'
import {
  LOCAL_SCOPE,
  clearDraft as clearStoredDraft,
  loadDraft,
  loadNotes,
  saveDraft as saveStoredDraft,
  saveNotes,
} from './storage'
import { useAuth } from './auth'
import { deleteNoteRow, loadNotesFromServer, subscribeToNotes, upsertNote } from './sync'

/**
 * Brain Dump notes.
 *
 * Same shape as the task store — local state is the fast path, localStorage is
 * the offline cache namespaced per account, Supabase is the cross-device
 * record — but much smaller, because notes have no views, filters or bin.
 *
 * Notes save on an explicit action rather than on a debounce, so writes go out
 * immediately and the caller can await one to drive a Saving…/Saved indicator.
 */

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface NoteStore {
  notes: BrainDump[]
  /** False until the first server read for this account has settled. */
  ready: boolean
  saveState: SaveState
  createNote: (content: string, tags: string[]) => Promise<BrainDump>
  updateNote: (id: string, patch: { content: string; tags: string[] }) => Promise<void>
  deleteNote: (id: string) => Promise<void>
  /** Composer text recovered from a previous session, read once on mount. */
  readDraft: () => { content: string; tags: string[] } | null
  writeDraft: (draft: { content: string; tags: string[] }) => void
  discardDraft: () => void
}

const NoteContext = createContext<NoteStore | null>(null)

/** Newest first — the order the history list reads in. */
function byNewest(a: BrainDump, b: BrainDump) {
  return b.createdAt.localeCompare(a.createdAt)
}

export function NoteProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id

  const [scope, setScope] = useState(LOCAL_SCOPE)
  const [notes, setNotes] = useState<BrainDump[]>(() => loadNotes(LOCAL_SCOPE) ?? [])
  const [ready, setReady] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')

  // Ids the server is known to have, so a realtime snapshot can drop rows
  // deleted elsewhere without discarding ones created offline here.
  const seen = useRef(new Set<string>())

  // ---- scope switching (sign in / sign out / account switch) ----
  useEffect(() => {
    if (authLoading) return
    const next = userId ?? LOCAL_SCOPE
    if (next === scope) return
    seen.current = new Set()
    setScope(next)
    setNotes(loadNotes(next) ?? [])
    setReady(false)
  }, [authLoading, userId, scope])

  // ---- initial server read ----
  useEffect(() => {
    if (authLoading || ready) return
    if (!userId) {
      setReady(true)
      return
    }
    let cancelled = false
    void (async () => {
      const { notes: serverNotes, fromServer } = await loadNotesFromServer(userId)
      if (cancelled) return
      if (fromServer) {
        for (const n of serverNotes) seen.current.add(n.id)
        setNotes((local) => {
          const ids = new Set(serverNotes.map((n) => n.id))
          return [...serverNotes, ...local.filter((n) => !ids.has(n.id))].sort(byNewest)
        })
      }
      // A failed read leaves us offline-only: local edits still work and are
      // pushed when the next save succeeds.
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [authLoading, userId, ready])

  // ---- realtime: subscribe once per account ----
  useEffect(() => {
    if (!userId || !ready) return
    return subscribeToNotes(userId, (serverNotes) => {
      const ids = new Set(serverNotes.map((n) => n.id))
      const removed = [...seen.current].filter((id) => !ids.has(id))
      removed.forEach((id) => seen.current.delete(id))
      ids.forEach((id) => seen.current.add(id))
      setNotes((local) => {
        const localOnly = local.filter((n) => !ids.has(n.id) && !removed.includes(n.id))
        return [...serverNotes, ...localOnly].sort(byNewest)
      })
    })
  }, [userId, ready])

  // ---- local cache ----
  useEffect(() => {
    saveNotes(scope, notes)
  }, [scope, notes])

  const push = useCallback(
    async (note: BrainDump) => {
      if (!userId) return
      await upsertNote(note, userId)
      seen.current.add(note.id)
    },
    [userId],
  )

  const createNote = useCallback<NoteStore['createNote']>(
    async (content, tags) => {
      const now = new Date().toISOString()
      const note: BrainDump = { id: makeId(), content, tags, createdAt: now, updatedAt: now }
      setNotes((prev) => [note, ...prev].sort(byNewest))
      setSaveState('saving')
      try {
        await push(note)
        setSaveState('saved')
      } catch {
        setSaveState('error')
      }
      return note
    },
    [push],
  )

  const updateNote = useCallback<NoteStore['updateNote']>(
    async (id, patch) => {
      // createdAt is never touched on edit; only updatedAt moves.
      const now = new Date().toISOString()
      let next: BrainDump | undefined
      setNotes((prev) =>
        prev.map((n) => {
          if (n.id !== id) return n
          next = { ...n, ...patch, updatedAt: now }
          return next
        }),
      )
      setSaveState('saving')
      try {
        if (next) await push(next)
        setSaveState('saved')
      } catch {
        setSaveState('error')
      }
    },
    [push],
  )

  const deleteNote = useCallback<NoteStore['deleteNote']>(
    async (id) => {
      setNotes((prev) => prev.filter((n) => n.id !== id))
      seen.current.delete(id)
      if (userId) {
        try {
          await deleteNoteRow(id)
        } catch {
          setSaveState('error')
        }
      }
    },
    [userId],
  )

  // Draft helpers write straight through to storage; keeping the text out of
  // React state avoids re-rendering the history list on every keystroke.
  const readDraft = useCallback(() => loadDraft(scope), [scope])
  const writeDraft = useCallback(
    (draft: { content: string; tags: string[] }) => saveStoredDraft(scope, draft),
    [scope],
  )
  const discardDraft = useCallback(() => clearStoredDraft(scope), [scope])

  const value = useMemo<NoteStore>(
    () => ({
      notes,
      ready,
      saveState,
      createNote,
      updateNote,
      deleteNote,
      readDraft,
      writeDraft,
      discardDraft,
    }),
    [
      notes,
      ready,
      saveState,
      createNote,
      updateNote,
      deleteNote,
      readDraft,
      writeDraft,
      discardDraft,
    ],
  )

  return <NoteContext.Provider value={value}>{children}</NoteContext.Provider>
}

export function useNotes(): NoteStore {
  const ctx = useContext(NoteContext)
  if (!ctx) throw new Error('useNotes must be used within NoteProvider')
  return ctx
}
