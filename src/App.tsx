import { Flag, Plus, RotateCcw, SearchX, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BrainDump } from './components/BrainDump'
import { EMPTY_PRESETS, EmptyState } from './components/EmptyState'
import { Header } from './components/Header'
import { SearchPalette } from './components/SearchPalette'
import { Settings } from './components/Settings'
import { Sidebar } from './components/Sidebar'
import { TaskEditor } from './components/TaskEditor'
import { TaskInput } from './components/TaskInput'
import { TaskItem } from './components/TaskItem'
import { UndoToast } from './components/UndoToast'
import { useNotes } from './store/noteStore'
import { useTaskStore } from './store/taskStore'
import AuthGate from './components/AuthGate'
import { DEFAULT_FILTERS, type Filters, type SortMode, type Task, type ViewId } from './types'
import { isOverdue, sectionLabel, todayStr, formatDueDate } from './utils/dateUtils'
import {
  applyFilters,
  applySearch,
  groupByDate,
  isFilterActive,
  sortTasks,
  tasksForView,
} from './utils/taskUtils'

function viewTitle(view: ViewId, lists: { id: string; name: string }[]): string {
  switch (view) {
    case 'inbox':
      return 'Inbox'
    case 'today':
      return 'Today'
    case 'upcoming':
      return 'Upcoming'
    case 'completed':
      return 'Completed'
    case 'favorites':
      return 'Favorites'
    case 'trash':
      return 'Recycle Bin'
    case 'braindump':
      return 'Brain Dump'
    default:
      return lists.find((l) => `list:${l.id}` === view)?.name ?? 'Inbox'
  }
}

function AppShell() {
  const store = useTaskStore()
  const { tasks, lists } = store
  const { notes } = useNotes()

  const [view, setView] = useState<ViewId>('today')
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [sort, setSort] = useState<SortMode>('manual')
  const [searchOpen, setSearchOpen] = useState(false)
  const [inlineQuery, setInlineQuery] = useState('')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [undoVisible, setUndoVisible] = useState(false)
  const undoTimer = useRef<number | null>(null)

  // Handle deleted list: fall back to inbox if the current view vanishes
  useEffect(() => {
    if (view.startsWith('list:') && !lists.some((l) => `list:${l.id}` === view)) {
      setView('inbox')
    }
  }, [lists, view])

  // Undo toast lifecycle
  useEffect(() => {
    if (store.lastDeleted) {
      setUndoVisible(true)
      if (undoTimer.current) window.clearTimeout(undoTimer.current)
      undoTimer.current = window.setTimeout(() => {
        setUndoVisible(false)
        store.clearUndo()
      }, 6000)
    } else {
      setUndoVisible(false)
    }
    return () => {
      if (undoTimer.current) window.clearTimeout(undoTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.lastDeleted])

  // The global key handler is bound once; read the live view through a ref.
  const viewRef = useRef(view)
  useEffect(() => {
    viewRef.current = view
  }, [view])

  const openQuickAdd = useCallback(() => setQuickAddOpen(true), [])
  const openSearch = useCallback(() => setSearchOpen(true), [])

  // Global keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const typing =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((o) => !o)
        return
      }
      if (typing) return
      if (e.key === '/') {
        e.preventDefault()
        setSearchOpen(true)
      } else if (e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (viewRef.current === 'braindump') return
        e.preventDefault()
        setQuickAddOpen(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const visibleTasks = useMemo(() => {
    let result = tasksForView(tasks, view)
    result = applyFilters(result, filters)
    if (inlineQuery.trim()) {
      result = applySearch(result, inlineQuery, lists)
    }
    return sortTasks(result, sort)
  }, [tasks, view, filters, sort, inlineQuery, lists])

  const defaultListId = view.startsWith('list:') ? view.slice(5) : null
  const defaultDueDate = view === 'today' ? todayStr() : null

  const subtitle =
    view === 'today'
      ? new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
      : undefined

  const presetKey = view.startsWith('list:') ? 'list' : (view as keyof typeof EMPTY_PRESETS)
  const preset = EMPTY_PRESETS[presetKey] ?? EMPTY_PRESETS.inbox
  const filtered = isFilterActive(filters) || inlineQuery.trim() !== ''

  return (
 <div className="app-shell flex h-dvh bg-bg text-ink">
      <Sidebar
        view={view}
        tasks={tasks}
        lists={lists}
        mobileOpen={mobileNavOpen}
        onNavigate={(v) => {
          setView(v)
          setInlineQuery('')
        }}
        onCloseMobile={() => setMobileNavOpen(false)}
        onAddList={(name, color) => store.addList(name, color)}
        onDeleteList={(id) => store.deleteList(id)}
        onOpenSettings={() => setSettingsOpen(true)}
        noteCount={notes.length}
      />

 <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
 <div className="mx-auto w-full max-w-2xl flex-1 px-4 pb-28 sm:px-6 sm:pb-16">
          {view === 'braindump' ? (
            <BrainDump onOpenMobileNav={() => setMobileNavOpen(true)} />
          ) : (
            <>
          <Header
            title={viewTitle(view, lists)}
            subtitle={subtitle}
            count={visibleTasks.length}
            filters={filters}
            sort={sort}
            lists={lists}
            onFiltersChange={setFilters}
            onSortChange={setSort}
            onOpenSearch={openSearch}
            onOpenMobileNav={() => setMobileNavOpen(true)}
            onAddTask={openQuickAdd}
          />

          {/* Inline search (visible when typing via palette is bypassed) */}
          {inlineQuery && (
 <div className="anim-fade-in mb-3 flex items-center gap-2 rounded-xl border border-accent/40 bg-accent-soft px-3 py-2 text-sm text-accent">
 <SearchX className="h-3.5 w-3.5" />
              Filtering by “{inlineQuery}”
              <button
                type="button"
                onClick={() => setInlineQuery('')}
 className="ml-auto cursor-pointer font-medium hover:underline"
              >
                Clear
              </button>
            </div>
          )}

          {/* Quick add */}
 <div className="mb-4">
            {view !== 'completed' && view !== 'trash' && (
              <TaskInput
                key={`${view}-${quickAddOpen}`}
                lists={lists}
                defaultListId={defaultListId}
                defaultDueDate={defaultDueDate}
                autoFocus={quickAddOpen}
                onCancel={() => setQuickAddOpen(false)}
                // The form stays open after Enter so several tasks can be
                // captured in a row; Esc (or the close button) dismisses it.
                onSubmit={(input) => store.addTask(input)}
              />
            )}
          </div>

          {/* Task list */}
          {visibleTasks.length === 0 ? (
            filtered ? (
              <EmptyState {...EMPTY_PRESETS.search} />
            ) : (
              <EmptyState {...preset} />
            )
          ) : view === 'trash' ? (
            <TrashRows tasks={visibleTasks} lists={lists} store={store} />
          ) : view === 'upcoming' ? (
            <UpcomingGroups
              tasks={visibleTasks}
              lists={lists}
              onEdit={setEditingTask}
              store={store}
            />
          ) : (
            <TaskRows tasks={visibleTasks} lists={lists} onEdit={setEditingTask} store={store} />
          )}

          {/* Completed section (non-completed views) */}
          {view !== 'completed' && view !== 'trash' && (
            <CompletedSection lists={lists} onEdit={setEditingTask} store={store} view={view} />
          )}

          {view === 'completed' && tasks.some((t) => t.completed && t.deletedAt === null) && (
 <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => store.clearCompleted()}
 className="cursor-pointer rounded-md border border-line px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:border-danger/40 hover:bg-danger-soft hover:text-danger"
              >
                Clear completed tasks
              </button>
            </div>
          )}

          {view === 'trash' && visibleTasks.length > 0 && (
 <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Permanently delete all tasks in the recycle bin? This cannot be undone.')) {
                    store.emptyTrash()
                  }
                }}
 className="cursor-pointer rounded-md border border-line px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:border-danger/40 hover:bg-danger-soft hover:text-danger"
              >
                Empty Recycle Bin
              </button>
            </div>
          )}
            </>
          )}
        </div>
      </main>

      {/* Mobile FAB */}
      {view !== 'completed' && view !== 'trash' && view !== 'braindump' && (
        <button
          type="button"
          onClick={() => setQuickAddOpen((o) => !o)}
          aria-label="Add task"
 className="fixed right-5 bottom-5 z-30 flex h-13 w-13 cursor-pointer items-center justify-center rounded-full glow bg-accent text-accent-ink transition-transform hover:scale-105 active:scale-95 sm:hidden"
        >
 <Plus className="h-6 w-6" strokeWidth={2.5} />
        </button>
      )}

      <SearchPalette
        tasks={tasks}
        lists={lists}
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={(task) => setEditingTask(task)}
      />

      {editingTask && (
        <TaskEditor
          task={editingTask}
          lists={lists}
          onSave={(patch) => store.updateTask(editingTask.id, patch)}
          onDelete={() => store.deleteTask(editingTask.id)}
          onClose={() => setEditingTask(null)}
        />
      )}

      {settingsOpen && <Settings onClose={() => setSettingsOpen(false)} />}

      {undoVisible && store.lastDeleted && (
        <UndoToast
          title={store.lastDeleted.task.title}
          onUndo={() => {
            store.undoDelete()
            setUndoVisible(false)
          }}
        />
      )}
    </div>
  )
}

function TaskRows({
  tasks,
  lists,
  onEdit,
  store,
}: {
  tasks: Task[]
  lists: ReturnType<typeof useTaskStore>['lists']
  onEdit: (t: Task) => void
  store: ReturnType<typeof useTaskStore>
}) {
  return (
 <ul className="space-y-0.5" role="list" aria-label="Tasks">
      {tasks.map((t) => (
        <li key={t.id}>
          <TaskItem
            task={t}
            lists={lists}
            onEdit={() => onEdit(t)}
            onDelete={() => store.deleteTask(t.id)}
            onToggleComplete={() => store.toggleComplete(t.id)}
            onToggleFavorite={() => store.toggleFavorite(t.id)}
            onDuplicate={() => store.duplicateTask(t.id)}
          />
        </li>
      ))}
    </ul>
  )
}

function UpcomingGroups({
  tasks,
  lists,
  onEdit,
  store,
}: {
  tasks: Task[]
  lists: ReturnType<typeof useTaskStore>['lists']
  onEdit: (t: Task) => void
  store: ReturnType<typeof useTaskStore>
}) {
  const groups = groupByDate(tasks)
  return (
 <div className="space-y-6">
      {groups.map((g) => (
        <section key={g.date} aria-label={sectionLabel(g.date)}>
          <h2
 className={`mb-1.5 px-3 text-xs font-semibold tracking-wide uppercase ${
              isOverdue(g.date) ? 'text-danger' : 'text-faint'
            }`}
          >
            {isOverdue(g.date) ? 'Overdue · ' : ''}
            {sectionLabel(g.date)}
          </h2>
          <TaskRows tasks={g.tasks} lists={lists} onEdit={onEdit} store={store} />
        </section>
      ))}
    </div>
  )
}

/** Rows in the Recycle Bin: restore or permanently delete each task. */
function TrashRows({
  tasks,
  lists,
  store,
}: {
  tasks: Task[]
  lists: ReturnType<typeof useTaskStore>['lists']
  store: ReturnType<typeof useTaskStore>
}) {
  return (
 <ul className="space-y-0.5" role="list" aria-label="Deleted tasks">
      {tasks.map((t) => {
        const due = formatDueDate(t.dueDate)
        const list = lists.find((l) => l.id === t.listId)
        return (
          <li key={t.id}>
 <div className="group anim-fade-slide-in flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 transition-colors hover:border-line hover:bg-surface">
 <div className="min-w-0 flex-1">
 <div className="truncate text-base text-muted line-through decoration-line-strong">
                  {t.title}
                </div>
 <div className="mt-0.5 flex items-center gap-2.5 text-xs text-faint">
                  {t.priority !== 'none' && (
                    <Flag
 className={`h-3 w-3 ${
                        t.priority === 'high'
                          ? 'text-p-high'
                          : t.priority === 'medium'
                            ? 'text-p-med'
                            : 'text-p-low'
                      }`}
                      aria-hidden
                    />
                  )}
                  {due && <span>{due.text}</span>}
                  {list && <span>{list.name}</span>}
                  {t.deletedAt && (
                    <span>
                      Deleted{' '}
                      {new Date(t.deletedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  )}
                </div>
              </div>
 <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => store.restoreTask(t.id)}
                  aria-label={`Restore ${t.title}`}
 className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent-soft"
                >
 <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                  Restore
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Permanently delete "${t.title}"? This cannot be undone.`)) {
                      store.permanentDelete(t.id)
                    }
                  }}
                  aria-label={`Permanently delete ${t.title}`}
 className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-faint transition-colors hover:bg-danger-soft hover:text-danger"
                >
 <Trash2 className="h-3.5 w-3.5" aria-hidden />
 <span className="hidden sm:inline">Delete forever</span>
                </button>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/** Collapsed completed tasks at the bottom of active views. */
function CompletedSection({
  view,
  lists,
  onEdit,
  store,
}: {
  view: ViewId
  lists: ReturnType<typeof useTaskStore>['lists']
  onEdit: (t: Task) => void
  store: ReturnType<typeof useTaskStore>
}) {
  const [expanded, setExpanded] = useState(false)

  const completed = useMemo(() => {
    let pool = store.tasks.filter((t) => t.completed && t.deletedAt === null)
    if (view.startsWith('list:')) {
      const id = view.slice(5)
      pool = pool.filter((t) => t.listId === id)
    } else if (view === 'favorites') {
      pool = pool.filter((t) => t.favorite)
    } else if (view === 'today') {
      const today = todayStr()
      pool = pool.filter((t) => t.completedAt?.startsWith(today))
    }
    return pool.sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
  }, [store.tasks, view])

  if (completed.length === 0) return null

  return (
 <div className="mt-6">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
 className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold tracking-wide text-faint uppercase transition-colors hover:text-ink"
      >
        <span
 className={`inline-block transition-transform ${expanded ? 'rotate-90' : ''}`}
          aria-hidden
        >
          ›
        </span>
        Completed · {completed.length}
      </button>
      {expanded && (
 <div className="anim-fade-slide-in mt-1">
          <TaskRows tasks={completed} lists={lists} onEdit={onEdit} store={store} />
        </div>
      )}
    </div>
  )
}

export default function App() {
  return (
    <AuthGate>
      <AppShell />
    </AuthGate>
  )
}
