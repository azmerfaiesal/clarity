import {
  CalendarDays,
  CheckCircle2,
  Inbox,
  ListPlus,
  Star,
  Trash2,
  X,
} from 'lucide-react'
import { useState } from 'react'
import type { Task, TaskList, ViewId } from '../types'
import { tasksForView } from '../utils/taskUtils'

const LIST_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

function NavItem({
  icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  count?: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] transition-colors ${
        active
          ? 'bg-neutral-200/70 font-medium text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100'
          : 'text-neutral-600 hover:bg-neutral-200/40 dark:text-neutral-400 dark:hover:bg-neutral-800/50'
      }`}
    >
      <span className={active ? 'text-indigo-500 dark:text-indigo-400' : 'text-neutral-400 dark:text-neutral-500'}>
        {icon}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="text-[12px] text-neutral-400 tabular-nums dark:text-neutral-500">
          {count}
        </span>
      )}
    </button>
  )
}

export function Sidebar({
  view,
  tasks,
  lists,
  mobileOpen,
  onNavigate,
  onCloseMobile,
  onAddList,
  onDeleteList,
}: {
  view: ViewId
  tasks: Task[]
  lists: TaskList[]
  mobileOpen: boolean
  onNavigate: (v: ViewId) => void
  onCloseMobile: () => void
  onAddList: (name: string, color: string) => void
  onDeleteList: (id: string) => void
}) {
  const [addingList, setAddingList] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [newListColor, setNewListColor] = useState(LIST_COLORS[0])

  const count = (v: ViewId) => tasksForView(tasks, v).filter((t) => !t.completed).length

  const submitList = () => {
    const name = newListName.trim()
    if (!name) return
    onAddList(name, newListColor)
    setNewListName('')
    setNewListColor(LIST_COLORS[Math.floor(Math.random() * LIST_COLORS.length)])
    setAddingList(false)
  }

  const nav = (v: ViewId) => {
    onNavigate(v)
    onCloseMobile()
  }

  const content = (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 pt-5 pb-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 shadow-sm">
          <CheckCircle2 className="h-4 w-4 text-white" strokeWidth={2.5} />
        </div>
        <span className="text-[16px] font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Clarity
        </span>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close menu"
          className="ml-auto cursor-pointer rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-200/60 md:hidden dark:hover:bg-neutral-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Primary nav */}
      <nav aria-label="Views" className="space-y-0.5 px-2.5">
        <NavItem
          icon={<Inbox className="h-4 w-4" />}
          label="Inbox"
          count={count('inbox')}
          active={view === 'inbox'}
          onClick={() => nav('inbox')}
        />
        <NavItem
          icon={<CalendarDays className="h-4 w-4" />}
          label="Today"
          count={count('today')}
          active={view === 'today'}
          onClick={() => nav('today')}
        />
        <NavItem
          icon={<CalendarDays className="h-4 w-4" />}
          label="Upcoming"
          count={count('upcoming')}
          active={view === 'upcoming'}
          onClick={() => nav('upcoming')}
        />
        <NavItem
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Completed"
          count={tasks.filter((t) => t.completed && t.deletedAt === null).length}
          active={view === 'completed'}
          onClick={() => nav('completed')}
        />
        <NavItem
          icon={<Star className="h-4 w-4" />}
          label="Favorites"
          count={tasks.filter((t) => t.favorite && !t.completed && t.deletedAt === null).length}
          active={view === 'favorites'}
          onClick={() => nav('favorites')}
        />
        <NavItem
          icon={<Trash2 className="h-4 w-4" />}
          label="Recycle Bin"
          count={tasks.filter((t) => t.deletedAt !== null).length}
          active={view === 'trash'}
          onClick={() => nav('trash')}
        />
      </nav>

      {/* Lists */}
      <div className="mt-6 flex-1 overflow-y-auto px-2.5">
        <div className="mb-1 flex items-center justify-between px-2.5">
          <span className="text-[11px] font-semibold tracking-wider text-neutral-400 uppercase dark:text-neutral-500">
            Lists
          </span>
          <button
            type="button"
            onClick={() => setAddingList((a) => !a)}
            aria-label="Create list"
            className="cursor-pointer rounded-md p-1 text-neutral-400 hover:bg-neutral-200/60 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
          >
            <ListPlus className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-0.5">
          {lists.map((l) => {
            const id: ViewId = `list:${l.id}`
            return (
              <div key={l.id} className="group relative">
                <button
                  type="button"
                  onClick={() => nav(id)}
                  aria-current={view === id ? 'page' : undefined}
                  className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] transition-colors ${
                    view === id
                      ? 'bg-neutral-200/70 font-medium text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100'
                      : 'text-neutral-600 hover:bg-neutral-200/40 dark:text-neutral-400 dark:hover:bg-neutral-800/50'
                  }`}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: l.color }}
                    aria-hidden
                  />
                  <span className="flex-1 truncate">{l.name}</span>
                  {count(id) > 0 && (
                    <span className="text-[12px] text-neutral-400 tabular-nums group-hover:opacity-0 dark:text-neutral-500">
                      {count(id)}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteList(l.id)}
                  aria-label={`Delete list ${l.name}`}
                  className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer rounded-md p-1 text-neutral-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
        </div>

        {addingList && (
          <div className="anim-fade-slide-in mt-1.5 rounded-xl border border-neutral-200 bg-white p-2.5 dark:border-neutral-700 dark:bg-neutral-900">
            <input
              autoFocus
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitList()
                if (e.key === 'Escape') setAddingList(false)
              }}
              placeholder="List name"
              aria-label="New list name"
              className="w-full bg-transparent text-[13px] text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-neutral-100"
            />
            <div className="mt-2 flex items-center justify-between">
              <div className="flex gap-1.5" role="radiogroup" aria-label="List color">
                {LIST_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={newListColor === c}
                    aria-label={`Color ${c}`}
                    onClick={() => setNewListColor(c)}
                    className={`h-4 w-4 cursor-pointer rounded-full transition-transform ${
                      newListColor === c ? 'ring-2 ring-neutral-400 ring-offset-1 dark:ring-neutral-500 dark:ring-offset-neutral-900' : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={submitList}
                disabled={!newListName.trim()}
                className="cursor-pointer rounded-md bg-indigo-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-indigo-500 disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-neutral-200/70 p-2.5 dark:border-neutral-800">
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden h-full w-64 shrink-0 border-r border-neutral-200/70 bg-neutral-50 md:block lg:w-68 dark:border-neutral-800 dark:bg-neutral-900/40">
        {content}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div
          className="anim-fade-in fixed inset-0 z-40 bg-neutral-950/30 backdrop-blur-[2px] md:hidden dark:bg-black/50"
          onClick={onCloseMobile}
          role="presentation"
        >
          <aside
            className="anim-fade-slide-in h-full w-72 border-r border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950"
            onClick={(e) => e.stopPropagation()}
            aria-label="Navigation drawer"
          >
            {content}
          </aside>
        </div>
      )}
    </>
  )
}
