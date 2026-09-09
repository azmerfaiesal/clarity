import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BrainDump as Note } from '../types'
import { BrainDump } from './BrainDump'

const noteStore = vi.hoisted(() => ({
  notes: [] as Note[],
  saveState: 'idle' as const,
  createNote: vi.fn(),
  updateNote: vi.fn(),
  deleteNote: vi.fn(),
  readDraft: vi.fn(() => null),
  writeDraft: vi.fn(),
  discardDraft: vi.fn(),
}))

vi.mock('../store/noteStore', () => ({
  useNotes: () => noteStore,
}))

vi.mock('../store/habitStore', () => ({
  useHabits: () => ({ habits: [], addWritingHabit: vi.fn() }),
}))

vi.mock('../store/theme', () => ({
  useWeekStart: () => 1,
}))

const savedNote: Note = {
  id: 'note-autosaved',
  content: 'Autosave me',
  tags: [],
  createdAt: '2026-09-09T02:00:00.000Z',
  updatedAt: '2026-09-09T02:00:00.000Z',
}

function renderComposer() {
  return render(
    <BrainDump
      onOpenMobileNav={vi.fn()}
      tagFilter={null}
      onTagFilter={vi.fn()}
    />,
  )
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

describe('BrainDump idle autosave', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Element.prototype.scrollIntoView = vi.fn()
    noteStore.notes = []
    noteStore.createNote.mockReset().mockResolvedValue(savedNote)
    noteStore.updateNote.mockReset().mockResolvedValue(undefined)
    noteStore.deleteNote.mockReset()
    noteStore.readDraft.mockReset().mockReturnValue(null)
    noteStore.writeDraft.mockReset()
    noteStore.discardDraft.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('creates a note after five idle seconds and keeps editing its intact content', async () => {
    renderComposer()
    const composer = screen.getByRole('textbox', { name: 'Brain dump' })

    fireEvent.change(composer, { target: { value: 'Autosave me' } })
    await advance(4_999)
    expect(noteStore.createNote).not.toHaveBeenCalled()

    await advance(1)
    expect(noteStore.createNote).toHaveBeenCalledTimes(1)
    expect(noteStore.createNote).toHaveBeenCalledWith('Autosave me', [])
    expect(noteStore.discardDraft).toHaveBeenCalledTimes(1)
    expect((composer as HTMLTextAreaElement).value).toBe('Autosave me')

    fireEvent.change(composer, { target: { value: 'Autosave me again' } })
    await advance(5_000)

    expect(noteStore.createNote).toHaveBeenCalledTimes(1)
    expect(noteStore.updateNote).toHaveBeenCalledWith('note-autosaved', {
      content: 'Autosave me again',
      tags: [],
    })
    expect((composer as HTMLTextAreaElement).value).toBe('Autosave me again')
  })

  it('restarts the idle window after each change', async () => {
    renderComposer()
    const composer = screen.getByRole('textbox', { name: 'Brain dump' })

    fireEvent.change(composer, { target: { value: 'First thought' } })
    await advance(4_000)
    fireEvent.change(composer, { target: { value: 'Finished thought' } })
    await advance(4_999)

    expect(noteStore.createNote).not.toHaveBeenCalled()

    await advance(1)
    expect(noteStore.createNote).toHaveBeenCalledTimes(1)
    expect(noteStore.createNote).toHaveBeenCalledWith('Finished thought', [])
  })

  it('updates an existing note in place after five idle seconds', async () => {
    noteStore.notes = [savedNote]
    renderComposer()

    fireEvent.click(screen.getByText('Autosave me').closest('button')!)
    const composer = screen.getByRole('textbox', { name: 'Brain dump' })
    fireEvent.change(composer, { target: { value: 'Edited without closing' } })
    await advance(5_000)

    expect(noteStore.createNote).not.toHaveBeenCalled()
    expect(noteStore.updateNote).toHaveBeenCalledWith('note-autosaved', {
      content: 'Edited without closing',
      tags: [],
    })
    expect((composer as HTMLTextAreaElement).value).toBe('Edited without closing')
  })

  it('cancels the pending autosave when Save is used manually', async () => {
    renderComposer()

    fireEvent.change(screen.getByRole('textbox', { name: 'Brain dump' }), {
      target: { value: 'Save this now' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    })
    await advance(5_000)

    expect(noteStore.createNote).toHaveBeenCalledTimes(1)
    expect(noteStore.createNote).toHaveBeenCalledWith('Save this now', [])
    expect(
      (screen.getByRole('textbox', { name: 'Brain dump' }) as HTMLTextAreaElement).value,
    ).toBe('')
  })

  it('does not create a duplicate when Save is pressed during an autosave', async () => {
    const creation = deferred<Note>()
    noteStore.createNote.mockReturnValue(creation.promise)
    renderComposer()

    const composer = screen.getByRole('textbox', { name: 'Brain dump' })
    fireEvent.change(composer, { target: { value: 'A slow autosave' } })
    await advance(5_000)
    expect(noteStore.createNote).toHaveBeenCalledTimes(1)

    fireEvent.change(composer, { target: { value: 'A slow autosave with another thought' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    creation.resolve(savedNote)
    await act(async () => {
      await creation.promise
    })

    expect(noteStore.createNote).toHaveBeenCalledTimes(1)
    expect(noteStore.updateNote).toHaveBeenCalledTimes(1)
    expect(noteStore.updateNote).toHaveBeenCalledWith('note-autosaved', {
      content: 'A slow autosave with another thought',
      tags: [],
    })
    expect(screen.getByRole('textbox', { name: 'Brain dump' })).toBeTruthy()
  })
})
