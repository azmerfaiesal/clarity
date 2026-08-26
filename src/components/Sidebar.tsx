import {
  CalendarDays,
  CheckCircle2,
  Inbox,
  ListPlus,
  Moon,
  ChevronRight,
  ClipboardList,
  House,
  NotebookPen,
  Pencil,
  Target,
  Settings as SettingsIcon,
  Star,
  Sun,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { HabitFilter, Task, TaskList, ViewId } from '../types'
import { tasksForView } from '../utils/taskUtils'
import { useTheme } from '../store/theme'

const LIST_COLORS = ['#3ddbf0', '#3bff9e', '#ffb020', '#ff4d5e', '#4aa8ff', '#a78bfa', '#f472b6']

function NavItem({
  icon,
  label,
  count,
  active,
  onClick,
  expanded,
  onToggle,
}: {
  icon: React.ReactNode
  label: string
  count?: number
  active: boolean
  onClick: () => void
  /** Present on sections that own a disclosure panel. */
  expanded?: boolean
  onToggle?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      aria-expanded={onToggle ? expanded : undefined}
      className={`relative flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
        active
          ? 'bg-accent-soft font-medium text-ink'
          : 'text-muted hover:bg-surface hover:text-ink'
      }`}
    >
      {/* Active rail — the one place the accent reads as "you are here". */}
      {active && (
        <span
          className="absolute top-1 bottom-1 -left-1.5 w-[2px] rounded-full bg-accent glow-sm"
          aria-hidden
        />
      )}
      <span className={active ? 'text-accent' : 'text-faint'}>{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="font-mono text-2xs text-faint tabular-nums">{count}</span>
      )}
      {onToggle && (
        <span
          role="button"
          tabIndex={-1}
          aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
          className="-mr-1 rounded p-0.5 text-faint transition-transform duration-200 hover:text-ink"
          style={{ transform: expanded ? 'rotate(90deg)' : 'none' }}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </span>
      )}
    </button>
  )
}


/**
 * Name + colour editor, shared by "new list" and "edit list" so both behave the
 * same way — Enter submits, Escape cancels from anywhere in the form, and the
 * actions sit on their own row (seven swatches plus two buttons will not fit on
 * one line in a 256px sidebar).
 */
function ListForm({
  initialName,
  initialColor,
  submitLabel,
  nameLabel,
  onSubmit,
  onCancel,
}: {
  initialName: string
  initialColor: string
  submitLabel: string
  nameLabel: string
  onSubmit: (name: string, color: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initialName)
  const [color, setColor] = useState(initialColor)

  // A list created before the current palette keeps a colour that is not in it.
  // Show that colour as an option so editing does not misrepresent the list as
  // having no colour selected.
  const swatches = LIST_COLORS.includes(initialColor)
    ? LIST_COLORS
    : [initialColor, ...LIST_COLORS]

  const submit = () => {
    if (!name.trim()) return
    onSubmit(name.trim(), color)
  }

  return (
    <div
      className="anim-fade-slide-in rounded-lg border border-line bg-raised p-2.5"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          onCancel()
        }
      }}
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
        }}
        placeholder="List name"
        aria-label={nameLabel}
        className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-faint"
      />
      <div className="mt-2.5">
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="List color">
          {swatches.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={`Color ${c}`}
              onClick={() => setColor(c)}
              className={`h-3.5 w-3.5 cursor-pointer rounded-full transition-transform ${
                color === c
                  ? 'ring-2 ring-accent ring-offset-2 ring-offset-raised'
                  : 'hover:scale-110'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <div className="mt-2.5 flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={onCancel}
            className="cursor-pointer rounded px-2 py-1 text-2xs font-medium text-muted transition-colors hover:bg-surface hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!name.trim()}
            className="cursor-pointer rounded bg-accent px-2 py-1 text-2xs font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
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
  onUpdateList,
  onDeleteList,
  onOpenSettings,
  noteCount,
  habitCount,
  habitFilter,
  onHabitFilter,
  noteTags,
  noteTag,
  onNoteTag,
}: {
  view: ViewId
  tasks: Task[]
  lists: TaskList[]
  mobileOpen: boolean
  onNavigate: (v: ViewId) => void
  onCloseMobile: () => void
  onAddList: (name: string, color: string) => void
  onUpdateList: (id: string, patch: { name?: string; color?: string }) => void
  onDeleteList: (id: string) => void
  onOpenSettings: () => void
  noteCount: number
  habitCount: number
  habitFilter: HabitFilter
  onHabitFilter: (f: HabitFilter) => void
  /** Tags in use across the notes, with counts, most used first. */
  noteTags: [string, number][]
  noteTag: string | null
  onNoteTag: (tag: string | null) => void
}) {
  const { theme, toggleTheme, controlledByHost } = useTheme()
  const [addingList, setAddingList] = useState(false)
  const [editingListId, setEditingListId] = useState<string | null>(null)
  const [tasksOpen, setTasksOpen] = useState(false)
  const [habitsOpen, setHabitsOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)

  const count = (v: ViewId) => tasksForView(tasks, v).filter((t) => !t.completed).length

  // Arriving in a section from elsewhere (Home, a link) should reveal its panel.
  useEffect(() => {
    if (isTaskView) setTasksOpen(true)
    if (view === 'habits') setHabitsOpen(true)
    if (view === 'notes') setNotesOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  // Everything that is a way of looking at tasks, as opposed to a section.
  const isTaskView =
    view === 'inbox' ||
    view === 'today' ||
    view === 'upcoming' ||
    view === 'completed' ||
    view === 'favorites' ||
    view === 'trash' ||
    view.startsWith('list:')

  const closeListForm = () => setAddingList(false)

  // Opening one form closes the other; two open editors in a narrow column is
  // confusing and the second would steal autofocus from the first.
  const openAddForm = () => {
    setEditingListId(null)
    setAddingList(true)
  }

  const openEditForm = (id: string) => {
    setAddingList(false)
    setEditingListId(id)
  }

  const nav = (v: ViewId) => {
    onNavigate(v)
    onCloseMobile()
  }

  // Keep the panel mounted while it animates back out. The ref stops a closed
  // sidebar from playing that exit once on first render.
  const [closing, setClosing] = useState(false)
  const everOpened = useRef(false)
  useEffect(() => {
    if (mobileOpen) {
      everOpened.current = true
      setClosing(false)
      return
    }
    if (!everOpened.current) return
    setClosing(true)
    const t = window.setTimeout(() => setClosing(false), 220)
    return () => window.clearTimeout(t)
  }, [mobileOpen])

  const content = (
    <div className="flex h-full min-h-0 flex-col">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 pt-5 pb-5">
        <div className="glow flex h-7 w-7 items-center justify-center rounded-md bg-accent">
          <CheckCircle2 className="h-4 w-4 text-accent-ink" strokeWidth={2.5} />
        </div>
        <span className="text-md font-semibold tracking-[-0.01em] text-ink">Clarity</span>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close menu"
          className="ml-auto cursor-pointer rounded-md p-1.5 text-faint hover:bg-surface md:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Top level: the four things this app tracks. */}
      <nav aria-label="Sections" className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2.5 pb-2">
        <NavItem
          icon={<House className="h-4 w-4" />}
          label="Home"
          active={view === 'home'}
          onClick={() => nav('home')}
        />
        <NavItem
          icon={<ClipboardList className="h-4 w-4" />}
          label="Tasks"
          count={count('today')}
          active={isTaskView}
          expanded={tasksOpen}
          onToggle={() => setTasksOpen((v) => !v)}
          onClick={() => {
            setTasksOpen(true)
            nav('today')
          }}
        />
        {/* Task views and lists are ways of slicing tasks, so they live under
            Tasks rather than competing with the sections. */}
        <div className="disclosure" data-open={tasksOpen}>
          <div>
            <div className="space-y-0.5 pt-0.5 pl-3.5">
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

              {/* Lists filter tasks, so they belong to this section. */}
              <div className="mt-3">
        <div className="mb-1.5 flex items-center justify-between px-2.5">
          <span className="label">Lists</span>
          <button
            type="button"
            onClick={() => (addingList ? closeListForm() : openAddForm())}
            aria-label={addingList ? 'Close new list form' : 'Create list'}
            className="cursor-pointer rounded p-1 text-faint transition-colors hover:bg-accent-soft hover:text-accent"
          >
            <ListPlus className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-0.5">
          {lists.map((l, i) => {
            const id: ViewId = `list:${l.id}`
            const active = view === id
            return (
              <div key={l.id} className="group relative">
                {editingListId === l.id ? (
                  <ListForm
                    initialName={l.name}
                    initialColor={l.color}
                    submitLabel="Save"
                    nameLabel={`Rename list ${l.name}`}
                    onSubmit={(name, color) => {
                      onUpdateList(l.id, { name, color })
                      setEditingListId(null)
                    }}
                    onCancel={() => setEditingListId(null)}
                  />
                ) : (
                  <>
                <button
                  type="button"
                  onClick={() => nav(id)}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
                    active
                      ? 'bg-accent-soft font-medium text-ink'
                      : 'text-muted hover:bg-surface hover:text-ink'
                  }`}
                >
                  {active && (
                    <span
                      className="absolute top-1 bottom-1 -left-1.5 w-[2px] rounded-full bg-accent glow-sm"
                      aria-hidden
                    />
                  )}
                  <span
                    className="dot-beam h-1.5 w-1.5 shrink-0 rounded-full"
                    style={
                      {
                        backgroundColor: l.color,
                        '--dot': l.color,
                        // Offset each row so the column breathes in a drift
                        // rather than throbbing in unison, which reads mechanical.
                        '--beam-delay': `${(i % 5) * 0.55}s`,
                      } as React.CSSProperties
                    }
                    aria-hidden
                  />
                  <span className="flex-1 truncate">{l.name}</span>
                  {count(id) > 0 && (
                    <span className="font-mono text-2xs text-faint tabular-nums group-hover:opacity-0">
                      {count(id)}
                    </span>
                  )}
                </button>
                <div className="absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <button
                    type="button"
                    onClick={() => openEditForm(l.id)}
                    aria-label={`Edit list ${l.name}`}
                    title="Rename or recolour"
                    className="cursor-pointer rounded p-1 text-faint transition-colors hover:text-accent"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteList(l.id)}
                    aria-label={`Delete list ${l.name}`}
                    title="Delete list"
                    className="cursor-pointer rounded p-1 text-faint transition-colors hover:text-danger"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                  </>
                )}
              </div>
            )
          })}
        </div>

        {addingList && (
          <div className="mt-1.5">
            <ListForm
              initialName=""
              initialColor={LIST_COLORS[Math.floor(Math.random() * LIST_COLORS.length)]}
              submitLabel="Add"
              nameLabel="New list name"
              onSubmit={(name, color) => {
                onAddList(name, color)
                setAddingList(false)
              }}
              onCancel={closeListForm}
            />
          </div>
        )}
              </div>

            </div>
          </div>
        </div>
        <NavItem
          icon={<Target className="h-4 w-4" />}
          label="Habits"
          count={habitCount}
          active={view === 'habits'}
          expanded={habitsOpen}
          onToggle={() => setHabitsOpen((v) => !v)}
          onClick={() => {
            setHabitsOpen(true)
            nav('habits')
          }}
        />
        {/* Filter the habit list by how often it repeats. */}
        <div className="disclosure" data-open={habitsOpen}>
          <div>
            <div className="space-y-0.5 pt-0.5 pl-3.5">
              {(
                [
                  ['all', 'All'],
                  ['daily', 'Daily'],
                  ['weekly', 'Weekly'],
                  ['monthly', 'Monthly'],
                ] as [HabitFilter, string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={view === 'habits' && habitFilter === value}
                  onClick={() => {
                    onHabitFilter(value)
                    nav('habits')
                  }}
                  className={`flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors ${
                    view === 'habits' && habitFilter === value
                      ? 'bg-accent-soft font-medium text-ink'
                      : 'text-muted hover:bg-surface hover:text-ink'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <NavItem
          icon={<NotebookPen className="h-4 w-4" />}
          label="Notes"
          count={noteCount}
          active={view === 'notes'}
          expanded={notesOpen}
          onToggle={() => setNotesOpen((v) => !v)}
          onClick={() => {
            setNotesOpen(true)
            nav('notes')
          }}
        />
        {/* Tags in use across the notes, as a way in. */}
        <div className="disclosure" data-open={notesOpen}>
          <div>
            <div className="space-y-0.5 pt-0.5 pl-3.5">
              <button
                type="button"
                aria-pressed={view === 'notes' && noteTag === null}
                onClick={() => {
                  onNoteTag(null)
                  nav('notes')
                }}
                className={`flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors ${
                  view === 'notes' && noteTag === null
                    ? 'bg-accent-soft font-medium text-ink'
                    : 'text-muted hover:bg-surface hover:text-ink'
                }`}
              >
                All notes
              </button>
              {noteTags.length === 0 ? (
                <p className="px-2.5 py-1 text-3xs text-faint">No tags yet.</p>
              ) : (
                noteTags.map(([tag, n]) => (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={view === 'notes' && noteTag === tag}
                    onClick={() => {
                      onNoteTag(tag)
                      nav('notes')
                    }}
                    className={`flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left transition-colors ${
                      view === 'notes' && noteTag === tag
                        ? 'bg-accent-soft font-medium text-ink'
                        : 'text-muted hover:bg-surface hover:text-ink'
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate font-mono text-3xs">{tag}</span>
                    <span className="shrink-0 font-mono text-3xs text-faint tabular-nums">{n}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className="flex items-center gap-1 border-t border-line p-2.5">
        <button
          type="button"
          onClick={() => {
            onOpenSettings()
            onCloseMobile()
          }}
          className="flex flex-1 cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-muted transition-colors hover:bg-surface hover:text-ink"
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

      {/* Mobile navigation. Rather than a drawer pinned to the left edge, the
          panel travels in from that edge and settles in the middle of the
          screen — and rewinds the same way, which is why it stays mounted for
          the length of the exit. */}
      {(mobileOpen || closing) && (
        <div
          className={`fixed inset-0 z-40 flex items-center justify-center bg-[var(--scrim)] p-4 backdrop-blur-[2px] md:hidden ${
            closing ? 'anim-fade-out' : 'anim-fade-in'
          }`}
          onClick={onCloseMobile}
          role="presentation"
        >
          <aside
            className={`${
              closing ? 'nav-to-edge' : 'nav-to-center'
            } flex max-h-[85dvh] w-full max-w-xs flex-col overflow-hidden rounded-2xl border border-line bg-raised/95 shadow-2xl shadow-black/25 backdrop-blur-xl dark:shadow-black/70`}
            onClick={(e) => e.stopPropagation()}
            aria-label="Navigation"
          >
            {content}
          </aside>
        </div>
      )}
    </>
  )
}
