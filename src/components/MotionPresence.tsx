import { useEffect, useReducer, useRef, useState } from 'react'
import {
  MOTION_MS,
  presenceTransition,
  type MotionPhase,
  type PresenceEvent,
  type PresenceState,
} from '../utils/motion'

type PresenceOptions = {
  exitMs?: number
  onExited?: () => void
}

function reducePresence(state: PresenceState, event: PresenceEvent) {
  return presenceTransition(state, event)
}

export function usePresenceValue<T>(
  value: T | null,
  options: PresenceOptions = {},
): { value: T; phase: MotionPhase } | null {
  const [presentValue, setPresentValue] = useState<T | null>(value)
  const [presence, dispatch] = useReducer(
    reducePresence,
    value,
    (initialValue): PresenceState =>
      initialValue === null
        ? { mounted: false, phase: null }
        : { mounted: true, phase: 'entering' },
  )
  const onExitedRef = useRef(options.onExited)
  const exitCompletedRef = useRef(false)
  const exitMs = options.exitMs ?? MOTION_MS.exit

  onExitedRef.current = options.onExited

  useEffect(() => {
    if (value !== null) {
      setPresentValue(value)
      dispatch({ type: 'show' })
      return
    }

    dispatch({ type: 'hide' })
  }, [value])

  useEffect(() => {
    if (presence.phase !== 'entering') return

    const frame = requestAnimationFrame(() => dispatch({ type: 'entered' }))
    return () => cancelAnimationFrame(frame)
  }, [presence.phase])

  useEffect(() => {
    if (presence.phase !== 'exiting') return

    const timeout = window.setTimeout(() => {
      exitCompletedRef.current = true
      dispatch({ type: 'exited' })
    }, exitMs)

    return () => window.clearTimeout(timeout)
  }, [exitMs, presence.phase])

  useEffect(() => {
    if (presence.mounted || !exitCompletedRef.current) return

    exitCompletedRef.current = false
    onExitedRef.current?.()
  }, [presence.mounted])

  if (!presence.mounted || presentValue === null || presence.phase === null) return null
  return { value: presentValue, phase: presence.phase }
}
