import {
  CalendarDays,
  CheckCircle2,
  Inbox,
  ListPlus,
  Moon,
  Settings as SettingsIcon,
  Star,
  Sun,
  Trash2,
  X,
} from 'lucide-react'
import { useState } from 'react'
import type { Task, TaskList, ViewId } from '../types'
import { tasksForView } from '../utils/taskUtils'
import { useTheme } from '../store/theme'

// A value ramp, not a hue wheel — lists stay distinguishable in monochrome.
const LIST_COLORS = ['#1a1a1a', '#333333', '#4d4d4d', '#666666', '#808080', '#999999', '#a6a6a6']

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
      className={`relative flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13.5px] transition-colors ${
        active
          ? 'bg-accent-soft font-medium text-ink'
          : 'text-muted hover:bg-surface hover:text-ink'
      }`}
    >
      {/* Active rail — the one place the accent reads as "you are here". */}
      {active && (
        <span
          className="absolute top-1 bottom-1 -left-1.5 w-[2px] rounded-full bg-accent"
          aria-hidden
        />
      )}
      <span className={active ? 'text-accent' : 'text-faint'}>{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="font-mono text-[11px] text-faint tabular-nums">{count}</span>
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
  onOpenSettings,
}: {
  view: ViewId
  tasks: Task[]
  lists: TaskList[]
  mobileOpen: boolean
  onNavigate: (v: ViewId) => void
  onCloseMobile: () => void
  onAddList: (name: string, color: string) => void
  onDeleteList: (id: string) => void
  onOpenSettings: () => void
}) {
  const { theme, toggleTheme, controlledByHost } = useTheme()
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
      <div className="flex items-center gap-2.5 px-4 pt-5 pb-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent">
          <CheckCircle2 className="h-4 w-4 text-accent-ink" strokeWidth={2.5} />
        </div>
        <span className="text-[15px] font-semibold tracking-[-0.01em] text-ink">Clarity</span>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close menu"
          className="ml-auto cursor-pointer rounded-md p-1.5 text-faint hover:bg-surface md:hidden"
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
      <div className="mt-7 flex-1 overflow-y-auto px-2.5">
        <div className="mb-1.5 flex items-center justify-between px-2.5">
          <span className="label">Lists</span>
          <button
            type="button"
            onClick={() => setAddingList((a) => !a)}
            aria-label="Create list"
            className="cursor-pointer rounded p-1 text-faint transition-colors hover:bg-accent-soft hover:text-accent"
          >
            <ListPlus className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-0.5">
          {lists.map((l) => {
            const id: ViewId = `list:${l.id}`
            const active = view === id
            return (
              <div key={l.id} className="group relative">
                <button
                  type="button"
                  onClick={() => nav(id)}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13.5px] transition-colors ${
                    active
                      ? 'bg-accent-soft font-medium text-ink'
                      : 'text-muted hover:bg-surface hover:text-ink'
                  }`}
                >
                  {active && (
                    <span
                      className="absolute top-1 bottom-1 -left-1.5 w-[2px] rounded-full bg-accent"
                      aria-hidden
                    />
                  )}
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full swatch"
                    style={{ backgroundColor: l.color }}
                    aria-hidden
                  />
                  <span className="flex-1 truncate">{l.name}</span>
                  {count(id) > 0 && (
                    <span className="font-mono text-[11px] text-faint tabular-nums group-hover:opacity-0">
                      {count(id)}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteList(l.id)}
                  aria-label={`Delete list ${l.name}`}
                  className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer rounded p-1 text-faint opacity-0 transition-opacity group-hover:opacity-100 hover:text-danger"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
        </div>

        {addingList && (
          <div className="anim-fade-slide-in mt-1.5 rounded-lg border border-line bg-raised p-2.5">
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
              className="w-full bg-transparent text-[13px] text-ink outline-none placeholder:text-faint"
            />
            <div className="mt-2.5 flex items-center justify-between">
              <div className="flex gap-1.5" role="radiogroup" aria-label="List color">
                {LIST_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={newListColor === c}
                    aria-label={`Color ${c}`}
                    onClick={() => setNewListColor(c)}
                    className={`h-3.5 w-3.5 cursor-pointer rounded-full swatch border border-line transition-transform ${
                      newListColor === c
                        ? 'ring-2 ring-accent ring-offset-2 ring-offset-raised'
                        : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={submitList}
                disabled={!newListName.trim()}
                className="cursor-pointer rounded bg-accent px-2 py-1 text-[11px] font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-1 border-t border-line p-2.5">
        <button
          type="button"
          onClick={() => {
            onOpenSettings()
            onCloseMobile()
          }}
          className="flex flex-1 cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13.5px] text-muted transition-colors hover:bg-surface hover:text-ink"
        >
          <SettingsIcon className="h-4 w-4 text-faint" />
          Settings
        </button>
        {!controlledByHost && (
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-faint transition-colors hover:bg-accent-soft hover:text-accent"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        )}
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="panel-l hidden h-full w-64 shrink-0 md:block lg:w-68">{content}</aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div
          className="anim-fade-in fixed inset-0 z-40 bg-[var(--scrim)] backdrop-blur-[2px] md:hidden"
          onClick={onCloseMobile}
          role="presentation"
        >
          <aside
            className="anim-fade-slide-in h-full w-72 border-r border-line bg-bg/95 backdrop-blur-xl"
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
