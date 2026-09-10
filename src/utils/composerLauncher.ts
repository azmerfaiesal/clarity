import type { ComposerKind } from '../components/MobileComposerLauncher'
import type { ViewId } from '../types'

export function isComposerLauncherView(view: ViewId): boolean {
  return (
    view === 'inbox' ||
    view === 'today' ||
    view === 'upcoming' ||
    view === 'completed' ||
    view === 'favorites' ||
    view === 'trash' ||
    view === 'habits' ||
    view === 'notes' ||
    view.startsWith('list:')
  )
}

export function composerDestination(kind: ComposerKind): ViewId {
  if (kind === 'routine') return 'habits'
  if (kind === 'note') return 'notes'
  return 'inbox'
}
