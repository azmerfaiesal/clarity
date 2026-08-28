import { beamIntensity } from '../utils/beam'

/**
 * Streak flame: an outline mark rather than the emoji, so it takes the habit's
 * colour and sits with the rest of the line iconography.
 *
 * Two paths — the outer flame with its notch, and the inner droplet — drawn in
 * currentColor so a single `color` drives both.
 */
export function FlameIcon({
  className = 'h-4 w-4',
  beaming = false,
  color,
  streak = 0,
  peak = 30,
}: {
  className?: string
  /** A live streak breathes; a dead one sits still. */
  beaming?: boolean
  color?: string
  /** Drives how brightly it burns. */
  streak?: number
  /** The streak length at which the glow is full — a habit's own target if set. */
  peak?: number
}) {
  const intensity = beamIntensity(streak, peak)
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${className} ${beaming ? 'flame-beam' : ''}`}
      style={
        {
          ...(color ? { '--flame': color } : {}),
          '--beam': intensity,
        } as React.CSSProperties
      }
      aria-hidden
    >
      <path d="M12 2.2c0 3.5 1.7 5.6 2.9 7 .8-.7 1.4-1.8 1.6-3.1C17.9 7.7 19 9.9 19 12.4a7 7 0 0 1-14 0c0-5.2 5.1-7.9 7-10.2Z" />
      <path d="M12 20.4a3.3 3.3 0 0 1-3.3-3.3c0-2 1.9-3.1 2.7-5 .9 1.9 3.2 2.7 3.2 5a3.3 3.3 0 0 1-2.6 3.3Z" />
    </svg>
  )
}
