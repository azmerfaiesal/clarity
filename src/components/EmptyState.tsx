import { CheckCircle2, Inbox, SearchX, Trash2, type LucideIcon } from 'lucide-react'

export function EmptyState({
  icon: Icon,
  title,
  subtitle,
}: {
  icon?: LucideIcon
  title: string
  subtitle: string
}) {
  const Display = Icon ?? CheckCircle2
  return (
    <div className="anim-fade-in flex flex-col items-center justify-center px-6 py-16 text-center sm:py-24">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-800/70">
        <Display className="h-6 w-6 text-neutral-400 dark:text-neutral-500" strokeWidth={1.5} />
      </div>
      <h2 className="text-[15px] font-medium text-neutral-800 dark:text-neutral-200">{title}</h2>
      <p className="mt-1 max-w-60 text-[13px] text-neutral-400 dark:text-neutral-500">{subtitle}</p>
    </div>
  )
}

export const EMPTY_PRESETS = {
  inbox: { icon: Inbox, title: 'Your inbox is empty.', subtitle: 'Capture anything you need to remember.' },
  today: { icon: CheckCircle2, title: "You're all caught up.", subtitle: 'No tasks remaining for today.' },
  upcoming: { icon: CheckCircle2, title: 'Nothing scheduled.', subtitle: 'Tasks with due dates will appear here.' },
  completed: { icon: CheckCircle2, title: 'No completed tasks yet.', subtitle: 'Finished tasks will land here.' },
  favorites: { icon: CheckCircle2, title: 'No favorites yet.', subtitle: 'Star a task to keep it close at hand.' },
  list: { icon: Inbox, title: 'This list is empty.', subtitle: 'Add a task to get started.' },
  trash: { icon: Trash2, title: 'Recycle bin is empty.', subtitle: 'Deleted tasks will appear here.' },
  search: { icon: SearchX, title: 'No results found.', subtitle: 'Try a different search term.' },
} as const
