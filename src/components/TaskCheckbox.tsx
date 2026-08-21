import { Check } from 'lucide-react'
import { useState } from 'react'
import type { Priority } from '../types'

const RING: Record<Priority, string> = {
  none: 'border-neutral-300 hover:border-neutral-400 dark:border-neutral-600 dark:hover:border-neutral-500',
  low: 'border-sky-400 dark:border-sky-500',
  medium: 'border-amber-400 dark:border-amber-500',
  high: 'border-red-400 dark:border-red-500',
}

const FILL: Record<Priority, string> = {
  none: 'bg-neutral-400 dark:bg-neutral-500',
  low: 'bg-sky-400 dark:bg-sky-500',
  medium: 'bg-amber-400 dark:bg-amber-500',
  high: 'bg-red-400 dark:bg-red-500',
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
          window.setTimeout(() => setPopping(false), 240)
        }
        onToggle()
      }}
      className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 cursor-pointer items-center justify-center rounded-full border-[1.5px] transition-all duration-150 ${
        completed
          ? `${FILL[priority]} border-transparent`
          : `${RING[priority]} bg-transparent hover:bg-neutral-100 dark:hover:bg-neutral-800`
      } ${popping ? 'anim-check-pop' : ''}`}
    >
      {completed && <Check className="h-3 w-3 text-white" strokeWidth={3.5} aria-hidden />}
    </button>
  )
}
