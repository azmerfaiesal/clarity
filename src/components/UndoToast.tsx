import { Undo2 } from 'lucide-react'
import type { MotionPhase } from '../utils/motion'

export function UndoToast({
  title,
  onUndo,
  phase,
}: {
  title: string
  onUndo: () => void
  phase: MotionPhase
}) {
  return (
    <div
      role="status"
      data-motion-state={phase}
      className="motion-toast fixed bottom-20 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 sm:bottom-6"
    >
      <div className="motion-toast-inner flex items-center gap-3 rounded-lg border border-line bg-raised px-4 py-3 shadow-xl shadow-black/20 backdrop-blur dark:shadow-black/70">
        <span className="min-w-0 flex-1 truncate text-sm text-ink">
          Deleted “{title}”
        </span>
        <button
          type="button"
          onClick={onUndo}
          className="motion-interactive inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-accent hover:bg-accent-soft"
        >
          <Undo2 className="h-3.5 w-3.5" />
          Undo
        </button>
      </div>
    </div>
  )
}
