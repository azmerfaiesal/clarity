import { useEffect, useRef, useState } from 'react'
import {
  MOTION_MS,
  presenceTransition,
  type MotionPhase,
  type PresenceState,
} from '../utils/motion'

type PresenceOptions = {
  exitMs?: number
  onExited?: () => void
}

type PresenceSnapshot<T> = {
  requestedValue: T | null
  presentValue: T | null
  presence: PresenceState
}

export function usePresenceValue<T>(
  value: T | null,
  options: PresenceOptions = {},
): { value: T; phase: MotionPhase } | null {
  const [snapshot, setSnapshot] = useState<PresenceSnapshot<T>>(() => ({
    requestedValue: value,
    presentValue: value,
    presence:
      value === null
        ? { mounted: false, phase: null }
        : { mounted: true, phase: 'entering' },
  }))
  const onExitedRef = useRef(options.onExited)
  const exitCompletedRef = useRef(false)
  const exitMs = options.exitMs ?? MOTION_MS.exit

  useEffect(() => {
    onExitedRef.current = options.onExited
  }, [options.onExited])

  useEffect(() => {
    if (snapshot.presence.phase !== 'entering') return

    const frame = requestAnimationFrame(() => {
      setSnapshot((current) => ({
        ...current,
        presence: presenceTransition(current.presence, { type: 'entered' }),
      }))
    })
    return () => cancelAnimationFrame(frame)
  }, [snapshot.presence.phase])

  useEffect(() => {
    if (snapshot.presence.phase !== 'exiting') return

    const timeout = window.setTimeout(() => {
      exitCompletedRef.current = true
      setSnapshot((current) => ({
        ...current,
        presence: presenceTransition(current.presence, { type: 'exited' }),
      }))
    }, exitMs)

    return () => window.clearTimeout(timeout)
  }, [exitMs, snapshot.presence.phase])

  useEffect(() => {
    if (snapshot.presence.mounted || !exitCompletedRef.current) return

    exitCompletedRef.current = false
    onExitedRef.current?.()
  }, [snapshot.presence.mounted])

  if (!Object.is(value, snapshot.requestedValue)) {
    setSnapshot({
      requestedValue: value,
      presentValue: value ?? snapshot.presentValue,
      presence: presenceTransition(snapshot.presence, {
        type: value === null ? 'hide' : 'show',
      }),
    })
  }

  if (
    !snapshot.presence.mounted ||
    snapshot.presentValue === null ||
    snapshot.presence.phase === null
  )
    return null
  return { value: snapshot.presentValue, phase: snapshot.presence.phase }
}
