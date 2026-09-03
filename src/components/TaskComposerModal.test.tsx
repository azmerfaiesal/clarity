import { act, render, screen } from '@testing-library/react'
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
  afterEach(() => vi.useRealTimers())

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
})
