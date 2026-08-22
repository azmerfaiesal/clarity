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
      className="anim-toast-in fixed bottom-20 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center gap-3 rounded-lg border border-line bg-raised px-4 py-3 shadow-xl shadow-black/20 backdrop-blur sm:bottom-6 dark:shadow-black/70"
    >
      <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
        Deleted “{title}”
      </span>
      <button
        type="button"
        onClick={onUndo}
        className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium text-accent transition-colors hover:bg-accent-soft"
      >
        <Undo2 className="h-3.5 w-3.5" />
        Undo
      </button>
    </div>
  )
}
