import {
  CalendarDays,
  CheckCircle2,
  BookOpen,
  Inbox,
  LayoutTemplate,
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
import type { HabitFilter, HabitTemplate, Task, TaskList, ViewId } from '../types'
import { tasksForView } from '../utils/taskUtils'
import { useTheme } from '../store/theme'
import { SUGGESTED_TEMPLATES } from '../store/habitTemplates'
import { HabitIcon } from './HabitIcon'

const LIST_COLORS = ['#3ddbf0', '#3bff9e', '#ffb020', '#ff4d5e', '#4aa8ff', '#a78bfa', '#f472b6']

/**
 * A nav row, with an optional disclosure toggle beside it.
 *
 * The toggle is a sibling of the row rather than a control nested inside it.
 * It used to be a `role="button"` span within the row's own `<button>`, which
 * is invalid — a button may not contain another — and browsers do not agree on
 * which one a tap belongs to. iOS Safari hands it to the outer one, so tapping
 * the chevron on a phone ran the row's handler instead: the panel opened and
 * could never be closed again.
 *
 * The row also toggles when it is already the view you are on, so the target
 * is the whole row rather than a chevron a few pixels wide.
 */
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
    <div
      className={`relative flex w-full items-center rounded-md transition-colors ${
        active ? 'bg-accent-soft font-medium text-ink' : 'text-muted hover:bg-surface hover:text-ink'
      }`}
    >
      {/* Active rail — the one place the accent reads as "you are here". */}
      {active && (
        <span
          className="absolute top-1 bottom-1 -left-1.5 w-[2px] rounded-full bg-accent glow-sm"
          aria-hidden
        />
      )}
      <button
        type="button"
        onClick={() => {
          // Already here: the only thing left for this row to do is fold.
          if (active && onToggle) onToggle()
          else onClick()
        }}
        aria-current={active ? 'page' : undefined}
        className={`flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 py-2 pl-2.5 text-left text-sm ${
          onToggle ? 'pr-1' : 'pr-2.5'
        }`}
      >
        <span className={active ? 'text-accent' : 'text-faint'}>{icon}</span>
        <span className="flex-1 truncate">{label}</span>
        {count !== undefined && count > 0 && (
          <span className="font-mono text-2xs text-faint tabular-nums">{count}</span>
        )}
      </button>
      {onToggle && (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
          // Padded well past the size of the glyph: a 14px chevron is not
          // something a thumb can be expected to find.
          className="mr-0.5 shrink-0 cursor-pointer rounded p-2.5 text-faint transition-colors hover:text-ink"
        >
          <ChevronRight
            className="h-3.5 w-3.5 transition-transform duration-200"
            style={{ transform: expanded ? 'rotate(90deg)' : 'none' }}
            aria-hidden
          />
        </button>
      )}
    </div>
  )
}

/**
 * One template in the sidebar: tap to start a habit from it. Saved templates
 * also carry edit and remove, revealed on hover so the resting list stays a
 * plain list of names.
 */
function TemplateRow({
  template,
  onUse,
  onEdit,
  onDelete,
}: {
  template: HabitTemplate
  onUse: () => void
  onEdit?: () => void
  onDelete?: () => void
}) {
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onUse}
        title={`Start a habit from ${template.name}`}
        className={`flex w-full cursor-pointer items-center gap-2 rounded-md py-1.5 pl-2.5 text-left text-xs text-muted transition-colors hover:bg-surface hover:text-ink ${
          onEdit ? 'pr-12' : 'pr-2.5'
        }`}
      >
        <span
          className="flex h-4 w-4 shrink-0 items-center justify-center"
          style={{ color: template.color }}
        >
          <HabitIcon icon={template.icon} className="h-3.5 w-3.5" />
        </span>
        <span className="truncate">{template.name}</span>
      </button>
      {onEdit && onDelete && (
        <div className="absolute top-1/2 right-1 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit template ${template.name}`}
            className="cursor-pointer rounded p-1 text-faint transition-colors hover:text-accent"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete template ${template.name}`}
            className="cursor-pointer rounded p-1 text-faint transition-colors hover:text-danger"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Name + colour editor, shared by "new category" and "edit category" so both
 * behave the same way — Enter submits, Escape cancels from anywhere in the
 * form, and the actions sit on their own row (seven swatches plus two buttons
 * will not fit on one line in a 256px sidebar).
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

  // A category created before the current palette keeps a colour that is not in
  // it. Show that colour as an option so editing does not misrepresent the
  // category as having no colour selected.
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
        placeholder="Category name"
        aria-label={nameLabel}
        className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-faint"
      />
      <div className="mt-2.5">
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Category colour">
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
  templates,
  onUseTemplate,
  onEditTemplate,
  onDeleteTemplate,
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
  /** The user's saved templates. Suggestions are built in and listed above. */
  templates: HabitTemplate[]
  onUseTemplate: (t: HabitTemplate) => void
  onEditTemplate: (t: HabitTemplate) => void
  onDeleteTemplate: (t: HabitTemplate) => void
  /** Tags in use across the notes, with counts, most used first. */
  noteTags: [string, number][]
  noteTag: string | null
  onNoteTag: (tag: string | null) => void
}) {
  const { theme, toggleTheme, controlledByHost } = useTheme()
  const [addingList, setAddingList] = useState(false)
  const [editingListId, setEditingListId] = useState<string | null>(null)
  const [tasksOpen, setTasksOpen] = useState(false)
  // Open by default: these were always on show, and collapsing is the new part.
  const [categoriesOpen, setCategoriesOpen] = useState(true)
  const [habitsOpen, setHabitsOpen] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)

  const count = (v: ViewId) => tasksForView(tasks, v).filter((t) => !t.completed).length

  // Arriving in a section from elsewhere (Home, a link) should reveal its panel.
  useEffect(() => {
    if (isTaskView) setTasksOpen(true)
    if (view.startsWith('list:')) setCategoriesOpen(true)
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
    // The form lives inside the panel, so opening one has to open the other.
    setCategoriesOpen(true)
  }

  const openEditForm = (id: string) => {
    setAddingList(false)
    setEditingListId(id)
    setCategoriesOpen(true)
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

              {/* Categories filter tasks, so they belong to this section.
                  Collapsible in their own right: a long column of them
                  otherwise crowds out everything below it. */}
              <div className="mt-3">
        <div className="flex items-center px-2.5">
          <button
            type="button"
            onClick={() => setCategoriesOpen((v) => !v)}
            aria-expanded={categoriesOpen}
            className="label flex flex-1 cursor-pointer items-center gap-1.5 rounded py-1 text-left transition-colors hover:text-ink"
          >
            Categories
            <ChevronRight
              className="h-3 w-3 transition-transform duration-200"
              style={{ transform: categoriesOpen ? 'rotate(90deg)' : 'none' }}
              aria-hidden
            />
          </button>
          <button
            type="button"
            onClick={() => (addingList ? closeListForm() : openAddForm())}
            aria-label={addingList ? 'Close new category form' : 'Create category'}
            className="cursor-pointer rounded p-1 text-faint transition-colors hover:bg-accent-soft hover:text-accent"
          >
            <ListPlus className="h-4 w-4" />
          </button>
        </div>

        <div className="disclosure" data-open={categoriesOpen}>
          <div>
        <div className="space-y-0.5 pt-0.5">
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
                    nameLabel={`Rename category ${l.name}`}
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
                    aria-label={`Edit category ${l.name}`}
                    title="Rename or recolour"
                    className="cursor-pointer rounded p-1 text-faint transition-colors hover:text-accent"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteList(l.id)}
                    aria-label={`Delete category ${l.name}`}
                    title="Delete category"
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
              nameLabel="New category name"
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

              {/* Templates. Suggestions and saved ones sit in one list because
                  they do the same job; only the saved ones can be changed. */}
              <button
                type="button"
                onClick={() => setTemplatesOpen((v) => !v)}
                aria-expanded={templatesOpen}
                className="flex w-full cursor-pointer items-center gap-1.5 rounded-md px-2.5 pt-2.5 pb-1 text-left text-2xs font-semibold tracking-wider text-faint uppercase transition-colors hover:text-ink"
              >
                <LayoutTemplate className="h-3 w-3" aria-hidden />
                Templates
                <ChevronRight
                  className="ml-auto h-3 w-3 transition-transform duration-200"
                  style={{ transform: templatesOpen ? 'rotate(90deg)' : 'none' }}
                  aria-hidden
                />
              </button>
              <div className="disclosure" data-open={templatesOpen}>
                <div>
                  <div className="space-y-0.5 pb-1">
                    <span className="block px-2.5 pt-1 pb-0.5 font-mono text-3xs text-faint">
                      Suggestions
                    </span>
                    {SUGGESTED_TEMPLATES.map((t) => (
                      <TemplateRow key={t.id} template={t} onUse={() => onUseTemplate(t)} />
                    ))}
                    <span className="block px-2.5 pt-2 pb-0.5 font-mono text-3xs text-faint">
                      Saved
                    </span>
                    {templates.length === 0 ? (
                      <p className="px-2.5 py-1 text-3xs text-faint">
                        Save a habit as a template and it lands here.
                      </p>
                    ) : (
                      templates.map((t) => (
                        <TemplateRow
                          key={t.id}
                          template={t}
                          onUse={() => onUseTemplate(t)}
                          onEdit={() => onEditTemplate(t)}
                          onDelete={() => onDeleteTemplate(t)}
                        />
                      ))
                    )}
                  </div>
                </div>
              </div>
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
          onClick={() => nav('guide')}
          aria-current={view === 'guide' ? 'page' : undefined}
          title="How Clarity works"
          aria-label="How Clarity works"
          className={`flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors ${
            view === 'guide'
              ? 'bg-accent-soft text-accent'
              : 'text-faint hover:bg-accent-soft hover:text-accent'
          }`}
        >
          <BookOpen className="h-4 w-4" />
        </button>
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
