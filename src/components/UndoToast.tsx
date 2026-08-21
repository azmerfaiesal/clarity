import { Undo2 } from 'lucide-react'

export function UndoToast({
  title,
  onUndo,
}: {
  title: string
  onUndo: () => void
}) {
  return (
    <div
      role="status"
      className="anim-toast-in fixed bottom-20 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center gap-3 rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 shadow-xl sm:bottom-6 dark:border-neutral-600 dark:bg-neutral-800"
    >
      <span className="min-w-0 flex-1 truncate text-[13px] text-neutral-200">
        Deleted “{title}”
      </span>
      <button
        type="button"
        onClick={onUndo}
        className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-indigo-400 transition-colors hover:bg-neutral-800 hover:text-indigo-300 dark:hover:bg-neutral-700"
      >
        <Undo2 className="h-3.5 w-3.5" />
        Undo
      </button>
    </div>
  )
}
