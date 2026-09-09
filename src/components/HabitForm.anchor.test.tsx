import { render, screen } from '@testing-library/react'
import type { ComponentProps, RefObject } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HabitForm } from './HabitForm'

function rect(x: number, y: number, width: number, height: number): DOMRect {
  return {
    x,
    y,
    width,
    height,
    top: y,
    right: x + width,
    bottom: y + height,
    left: x,
    toJSON: () => ({}),
  }
}

describe('HabitForm add-button origin', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('anchors a new-routine entrance to the add button', () => {
    const anchor = document.createElement('button')
    const anchorRef: RefObject<HTMLElement | null> = { current: anchor }

    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this === anchor) return rect(300, 700, 44, 44)
      if (this.getAttribute('role') === 'dialog') return rect(20, 100, 340, 500)
      return rect(0, 0, 0, 0)
    })

    const props = {
      templates: [],
      onSave: vi.fn(),
      onSaveTemplate: vi.fn(),
      onDeleteTemplate: vi.fn(),
      onClose: vi.fn(),
      phase: 'entering',
      anchorRef,
    } satisfies ComponentProps<typeof HabitForm> & {
      anchorRef: RefObject<HTMLElement | null>
    }

    render(<HabitForm {...props} />)

    const dialog = screen.getByRole('dialog', { name: 'New routine' })
    expect(dialog.classList.contains('routine-composer-modal')).toBe(true)
    expect(dialog.style.getPropertyValue('--routine-anchor-x')).toBe('132px')
    expect(dialog.style.getPropertyValue('--routine-anchor-y')).toBe('372px')
    expect(dialog.closest('.routine-composer-viewport')).not.toBeNull()
  })
})
