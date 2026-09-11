import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MOTION_MS } from '../utils/motion'
import { TaskComposerModal } from './TaskComposerModal'

const lists = [
  {
    id: 'work',
    name: 'Work',
    color: '#00aaff',
    createdAt: '2026-09-04T00:00:00.000Z',
  },
]

function renderComposer(overrides: Partial<React.ComponentProps<typeof TaskComposerModal>> = {}) {
  const onSubmit = vi.fn()
  const onClose = vi.fn()
  const anchorRef = { current: document.createElement('button') }
  const props: React.ComponentProps<typeof TaskComposerModal> = {
    open: true,
    anchorRef,
    lists,
    defaultListId: 'work',
    defaultDueDate: '2026-09-04',
    onSubmit,
    onClose,
    ...overrides,
  }

  return { ...render(<TaskComposerModal {...props} />), props, onSubmit, onClose, anchorRef }
}

describe('TaskComposerModal', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('uses the shared bottom-center global composer surface', () => {
    renderComposer()

    expect(screen.getByTestId('task-composer-backdrop').classList).toContain(
      'global-composer-viewport',
    )
    expect(screen.getByRole('dialog', { name: 'Add a task' }).classList).toContain(
      'global-composer-modal',
    )
  })

  it('submits the shared draft defaults and closes the composer', async () => {
    const onSubmit = vi.fn()
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(
      <TaskComposerModal
        open
        anchorRef={{ current: document.createElement('button') }}
        lists={lists}
        defaultListId="work"
        defaultDueDate="2026-09-04"
        onSubmit={onSubmit}
        onClose={onClose}
      />,
    )

    await user.type(screen.getByLabelText('Task name'), 'Ship Clarity')
    await user.click(screen.getByRole('button', { name: 'Add task' }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Ship Clarity',
        listId: 'work',
        dueDate: '2026-09-04',
      }),
    )
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('autosaves after five idle seconds without closing or clearing the composer', async () => {
    vi.useFakeTimers()
    const onAutosave = vi.fn().mockResolvedValue('task-autosaved')
    const { onClose } = renderComposer({ onAutosave })

    fireEvent.change(screen.getByLabelText('Task name'), {
      target: { value: 'Prepare launch notes' },
    })

    await act(async () => vi.advanceTimersByTime(4_999))
    expect(onAutosave).not.toHaveBeenCalled()

    await act(async () => vi.advanceTimersByTime(1))
    expect(onAutosave).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Prepare launch notes',
        listId: 'work',
        dueDate: '2026-09-04',
      }),
      null,
    )
    expect((screen.getByLabelText('Task name') as HTMLInputElement).value).toBe(
      'Prepare launch notes',
    )
    expect(onClose).not.toHaveBeenCalled()
  })

  it('updates the same autosaved task after later idle edits and finalizes it once', async () => {
    vi.useFakeTimers()
    const onAutosave = vi
      .fn()
      .mockImplementation(async (_input, taskId: string | null) => taskId ?? 'task-autosaved')
    const onSubmit = vi.fn()
    const onClose = vi.fn()
    renderComposer({ onAutosave, onSubmit, onClose })

    fireEvent.change(screen.getByLabelText('Task name'), {
      target: { value: 'Prepare launch notes' },
    })
    await act(async () => vi.advanceTimersByTime(5_000))

    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Include the deployment checklist' },
    })
    await act(async () => vi.advanceTimersByTime(5_000))

    expect(onAutosave).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ description: 'Include the deployment checklist' }),
      'task-autosaved',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Add task' }))
    await act(async () => Promise.resolve())

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Prepare launch notes',
        description: 'Include the deployment checklist',
      }),
      'task-autosaved',
    )
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('measures the selected launcher action as its entrance origin', () => {
    const anchor = document.createElement('button')
    const anchorRef = { current: anchor }
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this === anchor) return new DOMRect(300, 700, 44, 44)
      if (this.getAttribute('role') === 'dialog') return new DOMRect(20, 100, 340, 500)
      return new DOMRect()
    })

    const { rerender } = render(
      <TaskComposerModal
        open={false}
        anchorRef={anchorRef}
        lists={lists}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    rerender(
      <TaskComposerModal
        open
        anchorRef={anchorRef}
        lists={lists}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    const dialog = screen.getByRole('dialog', { name: 'Add a task' })
    expect(dialog.style.getPropertyValue('--composer-anchor-x')).toBe('132px')
    expect(dialog.style.getPropertyValue('--composer-anchor-y')).toBe('372px')
  })

  it('closes from Cancel without submitting', async () => {
    const user = userEvent.setup()
    const { onSubmit, onClose } = renderComposer()

    await user.type(screen.getByLabelText('Task name'), 'Keep this draft private')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('dismisses only from the backdrop, not from the dialog panel', async () => {
    const user = userEvent.setup()
    const { onClose } = renderComposer()

    await user.click(screen.getByRole('dialog', { name: 'Add a task' }))
    expect(onClose).not.toHaveBeenCalled()

    await user.click(screen.getByTestId('task-composer-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes when Escape is pressed', async () => {
    const user = userEvent.setup()
    const { onClose } = renderComposer()

    await user.click(screen.getByLabelText('Task name'))
    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('handles Escape from a non-text control through the modal', async () => {
    const user = userEvent.setup()
    const { onClose } = renderComposer()

    await user.click(screen.getByLabelText('Category'))
    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('keeps empty submission disabled', async () => {
    const user = userEvent.setup()
    const { onSubmit, onClose } = renderComposer()
    const addButton = screen.getByRole('button', { name: 'Add task' }) as HTMLButtonElement

    expect(addButton.disabled).toBe(true)
    await user.click(addButton)

    expect(onSubmit).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('restores focus to the anchor after the exit presence completes', () => {
    vi.useFakeTimers()
    const anchor = document.createElement('button')
    document.body.append(anchor)
    anchor.focus()

    try {
      const { rerender } = render(
        <TaskComposerModal
          open
          anchorRef={{ current: anchor }}
          lists={lists}
          defaultListId="work"
          defaultDueDate="2026-09-04"
          onSubmit={vi.fn()}
          onClose={vi.fn()}
        />,
      )

      expect(document.activeElement).toBe(screen.getByLabelText('Task name'))

      rerender(
        <TaskComposerModal
          open={false}
          anchorRef={{ current: anchor }}
          lists={lists}
          defaultListId="work"
          defaultDueDate="2026-09-04"
          onSubmit={vi.fn()}
          onClose={vi.fn()}
        />,
      )

      expect(screen.getByRole('dialog', { name: 'Add a task' })).not.toBeNull()
      act(() => vi.advanceTimersByTime(MOTION_MS.exit))

      expect(screen.queryByRole('dialog', { name: 'Add a task' })).toBeNull()
      expect(document.activeElement).toBe(anchor)
    } finally {
      anchor.remove()
    }
  })

  it('keeps backdrop interaction ownership while only the exiting content is inert', () => {
    const outsideInteraction = vi.fn()
    const onSubmit = vi.fn()
    const onClose = vi.fn()
    const anchorRef = { current: document.createElement('button') }
    const modal = (open: boolean) => (
      <div onClick={outsideInteraction}>
        <TaskComposerModal
          open={open}
          anchorRef={anchorRef}
          lists={lists}
          defaultListId="work"
          defaultDueDate="2026-09-04"
          onSubmit={onSubmit}
          onClose={onClose}
        />
      </div>
    )
    const { rerender } = render(modal(true))
    const backdrop = screen.getByTestId('task-composer-backdrop')
    const dialog = screen.getByRole('dialog', { name: 'Add a task' })
    const title = screen.getByLabelText('Task name')

    fireEvent.change(title, { target: { value: 'Must not submit' } })
    rerender(modal(false))

    expect(backdrop.dataset.motionState).toBe('exiting')
    expect(backdrop.hasAttribute('inert')).toBe(false)
    expect(dialog.hasAttribute('inert')).toBe(true)

    fireEvent.click(backdrop)
    fireEvent.keyDown(title, { key: 'Enter' })

    expect(outsideInteraction).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('resets and refocuses when reopening cancels an in-progress exit', () => {
    const anchor = document.createElement('button')
    document.body.append(anchor)
    const anchorRef = { current: anchor }
    const onSubmit = vi.fn()
    const onClose = vi.fn()
    const modal = (open: boolean) => (
      <TaskComposerModal
        open={open}
        anchorRef={anchorRef}
        lists={lists}
        defaultListId="work"
        defaultDueDate="2026-09-04"
        onSubmit={onSubmit}
        onClose={onClose}
      />
    )

    try {
      const { rerender } = render(modal(true))
      fireEvent.change(screen.getByLabelText('Task name'), {
        target: { value: 'Stale draft' },
      })
      fireEvent.click(screen.getByTestId('task-composer-backdrop'))

      rerender(modal(false))
      expect(screen.getByTestId('task-composer-backdrop').dataset.motionState).toBe('exiting')

      anchor.focus()
      rerender(modal(true))

      const title = screen.getByLabelText('Task name') as HTMLInputElement
      expect(title.value).toBe('')
      expect(document.activeElement).toBe(title)
      expect(onClose).toHaveBeenCalledTimes(1)
    } finally {
      anchor.remove()
    }
  })
})
