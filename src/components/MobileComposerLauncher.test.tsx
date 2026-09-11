import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MobileComposerLauncher } from './MobileComposerLauncher'

describe('MobileComposerLauncher', () => {
  it('uses the familiar Create treatment and a vertical action fan on the web', () => {
    render(
      <MobileComposerLauncher
        variant="web"
        open={false}
        onOpenChange={vi.fn()}
        onChoose={vi.fn()}
      />,
    )

    const trigger = screen.getByRole('button', { name: 'Create' })
    expect(trigger.textContent).toContain('Create')
    expect(trigger.closest('.composer-launcher')?.getAttribute('data-variant')).toBe('web')
    expect(screen.getByTestId('composer-launcher-layer').getAttribute('data-layout')).toBe(
      'vertical',
    )
  })

  it('keeps the compact native trigger and its up-left action fan', () => {
    render(
      <MobileComposerLauncher
        variant="native"
        open={false}
        onOpenChange={vi.fn()}
        onChoose={vi.fn()}
      />,
    )

    const trigger = screen.getByRole('button', { name: 'Create new' })
    expect(trigger.textContent).not.toContain('Create')
    expect(trigger.closest('.composer-launcher')?.getAttribute('data-variant')).toBe('native')
    expect(screen.getByTestId('composer-launcher-layer').getAttribute('data-layout')).toBe(
      'up-left',
    )
  })

  it('fans out all creation choices and reports the chosen button as the composer origin', async () => {
    const user = userEvent.setup()
    const onChoose = vi.fn()

    function Harness() {
      const [open, setOpen] = useState(false)
      return <MobileComposerLauncher open={open} onOpenChange={setOpen} onChoose={onChoose} />
    }

    render(<Harness />)

    const trigger = screen.getByRole('button', { name: 'Create new' })
    await user.click(trigger)

    expect(screen.getByRole('button', { name: 'New task' }).getAttribute('tabindex')).toBe('0')
    expect(screen.getByRole('button', { name: 'New routine' }).getAttribute('tabindex')).toBe('0')
    expect(screen.getByRole('button', { name: 'New note' }).getAttribute('tabindex')).toBe('0')

    const task = screen.getByRole('button', { name: 'New task' })
    await user.click(task)

    expect(onChoose).toHaveBeenCalledWith('task', task)
  })

  it('closes the action fan when its scrim is tapped', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()

    render(<MobileComposerLauncher open onOpenChange={onOpenChange} onChoose={vi.fn()} />)

    await user.click(screen.getByTestId('composer-launcher-scrim'))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('exposes a close state while expanded and returns focus after closing', async () => {
    const user = userEvent.setup()

    function Harness() {
      const [open, setOpen] = useState(false)
      return (
        <MobileComposerLauncher open={open} onOpenChange={setOpen} onChoose={vi.fn()} />
      )
    }

    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Create new' })
    await user.click(trigger)

    expect(
      screen.getByRole('button', { name: 'Close creation menu' }).getAttribute('aria-expanded'),
    ).toBe('true')

    await user.keyboard('{Escape}')

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Create new' }))
  })
})
