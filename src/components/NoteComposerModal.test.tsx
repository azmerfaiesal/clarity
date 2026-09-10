import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NoteComposerModal } from './NoteComposerModal'

const createNote = vi.fn()
const updateNote = vi.fn()
const writeDraft = vi.fn()
const discardDraft = vi.fn()

vi.mock('../store/noteStore', () => ({
  useNotes: () => ({
    saveState: 'saved',
    createNote,
    updateNote,
    readDraft: () => null,
    writeDraft,
    discardDraft,
  }),
}))

describe('NoteComposerModal', () => {
  beforeEach(() => {
    createNote.mockReset()
    updateNote.mockReset()
    writeDraft.mockReset()
    discardDraft.mockReset()
    createNote.mockResolvedValue({
      id: 'note-1',
      content: 'A protected thought',
      tags: [],
      createdAt: '2026-09-10T00:00:00.000Z',
      updatedAt: '2026-09-10T00:00:00.000Z',
    })
    updateNote.mockResolvedValue(undefined)
  })

  afterEach(() => vi.useRealTimers())

  it('autosaves after five idle seconds without closing the composer', async () => {
    vi.useFakeTimers()
    const onCreated = vi.fn()

    render(
      <NoteComposerModal
        open
        anchorRef={{ current: document.createElement('button') }}
        onCreated={onCreated}
        onClose={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByLabelText('Note content'), {
      target: { value: 'A protected thought' },
    })
    await act(async () => vi.advanceTimersByTime(5_000))

    expect(createNote).toHaveBeenCalledWith('A protected thought', [])
    expect(screen.getByRole('dialog', { name: 'New note' })).not.toBeNull()
    expect(onCreated).not.toHaveBeenCalled()
  })

  it('opens a blank composer after an autosaved note is closed', async () => {
    vi.useFakeTimers()
    const anchor = document.createElement('button')

    function Harness() {
      const [open, setOpen] = useState(true)
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open note composer
          </button>
          <NoteComposerModal
            open={open}
            anchorRef={{ current: anchor }}
            onCreated={vi.fn()}
            onClose={() => setOpen(false)}
          />
        </>
      )
    }

    render(<Harness />)
    fireEvent.change(screen.getByLabelText('Note content'), {
      target: { value: 'Already saved' },
    })
    await act(async () => vi.advanceTimersByTime(5_000))
    fireEvent.click(screen.getByRole('button', { name: 'Close note composer' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open note composer' }))

    expect((screen.getByLabelText('Note content') as HTMLTextAreaElement).value).toBe('')
  })

  it('closes through the creation callback only after explicit Save', async () => {
    const user = userEvent.setup()
    const onCreated = vi.fn()

    render(
      <NoteComposerModal
        open
        anchorRef={{ current: document.createElement('button') }}
        onCreated={onCreated}
        onClose={vi.fn()}
      />,
    )

    await user.type(screen.getByLabelText('Note content'), 'A protected thought')
    await user.type(screen.getByLabelText('Add note tags'), 'clarity, ios')
    await user.click(screen.getByRole('button', { name: 'Save note' }))

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('note-1'))
    expect(createNote).toHaveBeenCalledWith('A protected thought', ['clarity', 'ios'])
  })

  it('does not mark newer typing saved when an older autosave finishes', async () => {
    vi.useFakeTimers()
    let finishCreate: ((note: { id: string }) => void) | undefined
    createNote.mockReturnValue(
      new Promise((resolve) => {
        finishCreate = resolve
      }),
    )

    render(
      <NoteComposerModal
        open
        anchorRef={{ current: document.createElement('button') }}
        onCreated={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByLabelText('Note content'), { target: { value: 'First' } })
    act(() => vi.advanceTimersByTime(5_000))
    fireEvent.change(screen.getByLabelText('Note content'), { target: { value: 'First and newer' } })
    await act(async () => finishCreate?.({ id: 'note-1' }))
    await act(async () => vi.advanceTimersByTime(5_000))

    expect(updateNote).toHaveBeenCalledWith('note-1', {
      content: 'First and newer',
      tags: [],
    })
  })
})
