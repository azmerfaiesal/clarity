export const MOTION_MS = {
  press: 160,
  standard: 320,
  prominent: 420,
  exit: 280,
} as const

export type MotionPhase = 'entering' | 'entered' | 'exiting'
export type PresenceState = { mounted: boolean; phase: MotionPhase | null }
export type PresenceEvent = { type: 'show' | 'entered' | 'hide' | 'exited' }

export function presenceTransition(state: PresenceState, event: PresenceEvent): PresenceState {
  if (event.type === 'show') return { mounted: true, phase: 'entering' }
  if (event.type === 'entered' && state.mounted) return { mounted: true, phase: 'entered' }
  if (event.type === 'hide' && state.mounted) return { mounted: true, phase: 'exiting' }
  if (event.type === 'exited') return { mounted: false, phase: null }
  return state
}
