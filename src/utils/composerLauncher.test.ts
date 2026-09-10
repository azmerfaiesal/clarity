import { describe, expect, it } from 'vitest'
import { composerDestination, isComposerLauncherView } from './composerLauncher'

describe('global composer routing', () => {
  it('shows the native launcher throughout tasks, routines, and notes only', () => {
    for (const view of [
      'inbox',
      'today',
      'upcoming',
      'completed',
      'favorites',
      'trash',
      'list:work',
      'habits',
      'notes',
    ] as const) {
      expect(isComposerLauncherView(view)).toBe(true)
    }
    expect(isComposerLauncherView('home')).toBe(false)
    expect(isComposerLauncherView('guide')).toBe(false)
  })

  it('routes every created item to the page that guarantees it is visible', () => {
    expect(composerDestination('task')).toBe('inbox')
    expect(composerDestination('routine')).toBe('habits')
    expect(composerDestination('note')).toBe('notes')
  })
})
