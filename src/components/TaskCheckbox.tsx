import { Check } from 'lucide-react'
import { useState } from 'react'
import type { Priority } from '../types'

const RING: Record<Priority, string> = {
  none: 'border-line-strong hover:border-accent',
  low: 'border-p-low',
  medium: 'border-p-med',
  high: 'border-p-high',
}

export function TaskCheckbox({
  completed,
  priority,
  onToggle,
}: {
  completed: boolean
  priority: Priority
  onToggle: () => void
}) {
  const [popping, setPopping] = useState(false)

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={completed}
      aria-label={completed ? 'Mark as not completed' : 'Mark as completed'}
      onClick={(e) => {
        e.stopPropagation()
        if (!completed) {
          setPopping(true)
          window.setTimeout(() => setPopping(false), 260)
        }
        onToggle()
      }}
      className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 cursor-pointer items-center justify-center rounded-full border-[1.5px] transition-all duration-150 ${
        completed
          ? 'border-success bg-success glow-success'
          : `${RING[priority]} bg-transparent hover:bg-accent-soft`
      } ${popping ? 'anim-check-pop' : ''}`}
    >
      {completed && <Check className="h-3 w-3 text-bg" strokeWidth={3.5} aria-hidden />}
    </button>
  )
}
