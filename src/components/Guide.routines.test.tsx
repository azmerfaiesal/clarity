import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Guide } from './Guide'

describe('Guide task recurrence and Routines language', () => {
  it('documents recurring tasks and names the Routines section consistently', () => {
    render(<Guide onOpenMobileNav={vi.fn()} onNavigate={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Routines' })).not.toBeNull()
    expect(screen.queryByRole('heading', { name: 'Habits' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Repeating tasks' })).not.toBeNull()
    expect(screen.getByText(/creates the next occurrence/i)).not.toBeNull()
  })
})
