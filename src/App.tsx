import { Flag, RotateCcw, SearchX, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { BrainDump } from './components/BrainDump'
import { Guide } from './components/Guide'
import { Home } from './components/Home'
import { HabitForm } from './components/HabitForm'
import { HabitTracker } from './components/HabitTracker'
import { EMPTY_PRESETS, EmptyState } from './components/EmptyState'
import { Header } from './components/Header'
import { GlobalSearch } from './components/GlobalSearch'
import { MobileComposerLauncher, type ComposerKind } from './components/MobileComposerLauncher'
import { NoteComposerModal } from './components/NoteComposerModal'
import { Panel, PanelBody, PanelHeader } from './components/Panel'
import { Settings } from './components/Settings'
import { Sidebar } from './components/Sidebar'
import { TaskComposerModal } from './components/TaskComposerModal'
import { TaskEditor } from './components/TaskEditor'
import type { TaskDraftInput } from './components/TaskComposerFields'
import { TaskInput } from './components/TaskInput'
import { TaskItem } from './components/TaskItem'
import { UndoToast } from './components/UndoToast'
import {
  isNativeApp,
  nativeSelectionHaptic,
  nativeSuccessHaptic,
  nativeWarningHaptic,
} from './native/platform'
import { useHabits } from './store/habitStore'
import { loadView, saveView } from './store/storage'
import { checkReminders, syncNativeReminders } from './store/notifications'
import { useNotes } from './store/noteStore'
import { useTaskStore } from './store/taskStore'
import AuthGate from './components/AuthGate'
import {
  DEFAULT_FILTERS,
  type Filters,
  type Habit,
  type HabitFilter,
  type HabitTemplate,
  type SortMode,
  type Task,
  type ViewId,
} from './types'
import { addDays, isOverdue, sectionLabel, todayStr, formatDueDate } from './utils/dateUtils'
import {
  applyFilters,
  applySearch,
  groupByDate,
  isFilterActive,
  sortTasks,
  tasksForView,
} from './utils/taskUtils'
import {
  canStartDrawerDrag,
  createDrawerFrameScheduler,
  dragDirection,
  drawerProgress,
  drawerReleaseVelocity,
  drawerSettleDuration,
  mobileDrawerWidth,
  shouldOpenDrawer,
} from './utils/mobileDrawer'
import type { DrawerMotion } from './utils/mobileDrawer'
import { useMediaQuery } from './utils/useMediaQuery'
import { usePresenceValue } from './components/MotionPresence'
import { composerDestination, isComposerLauncherView } from './utils/composerLauncher'

type MobileDrawerDrag = {
  pointerId: number
  startX: number
  startY: number
  lastX: number
  lastTime: number
  originProgress: number
  progress: number
  velocityX: number
  axis: 'pending' | 'horizontal' | 'vertical'
}

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
    case 'notes':
      return 'Notes'
    case 'habits':
      return 'My Routines'
    case 'guide':
      return 'How Clarity works'
    case 'home':
      return 'Home'
    default:
      return lists.find((l) => `list:${l.id}` === view)?.name ?? 'Inbox'
  }
}

/**
 * Where "add a task" means something, and so where the mobile button belongs.
 * Named rather than a list of exclusions, so a new section does not inherit it
 * by default — which is how the guide ended up with a button over its text.
 */
function acceptsNewTask(view: ViewId): boolean {
  return (
    view === 'inbox' ||
    view === 'today' ||
    view === 'upcoming' ||
    view === 'favorites' ||
    view.startsWith('list:')
  )
}

const SECTION_VIEWS: ViewId[] = [
  'home',
  'inbox',
  'today',
  'upcoming',
  'completed',
  'favorites',
  'trash',
  'notes',
  'habits',
  'guide',
]

/** A stored view is only trusted if it still names something the app has. */
function restoreView(): ViewId {
  const saved = loadView()
  if (!saved) return 'home'
  if (SECTION_VIEWS.includes(saved as ViewId)) return saved as ViewId
  return saved.startsWith('list:') ? (saved as ViewId) : 'home'
}

function AppShell() {
  const store = useTaskStore()
  const { tasks, lists, addTask, updateTask } = store
  const { notes } = useNotes()
  // Keep this hook unconditional: a native iPad in landscape still uses the
  // compact composer even though its viewport is wider than the web breakpoint.
  const isNarrowTaskEntry = useMediaQuery('(max-width: 639px)')
  const compactTaskEntry = isNativeApp || isNarrowTaskEntry

  // Tags in use across the notes, most used first — the sidebar's way in.
  const noteTags = useMemo(() => {
    const counts = new Map<string, number>()
    for (const n of notes) for (const t of n.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [notes])
  const { habits, templates, addHabit, saveAsTemplate, deleteTemplate } = useHabits()

  // Reopen where you left off.
  const [view, setView] = useState<ViewId>(restoreView)
  const [habitFilter, setHabitFilter] = useState<HabitFilter>('all')
  const [noteTag, setNoteTag] = useState<string | null>(null)
  // A template picked in the sidebar: either the seed for a new habit, or the
  // template itself opened for editing. Held here because the sidebar raises
  // it and the habit view is what shows the dialog.
  const [seedTemplate, setSeedTemplate] = useState<HabitTemplate | null>(null)
  const [editTemplate, setEditTemplate] = useState<HabitTemplate | null>(null)
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [sort, setSort] = useState<SortMode>('manual')
  // The docked search bar is always mounted, so "opening" search is only ever a
  // matter of putting the caret in it.
  const searchRef = useRef<HTMLInputElement>(null)
  // A note picked from search: the Notes view opens it in the composer.
  const [openNoteId, setOpenNoteId] = useState<string | null>(null)
  const [inlineQuery, setInlineQuery] = useState('')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [mobileNavDragging, setMobileNavDragging] = useState(false)
  const [mobileNavWidth, setMobileNavWidth] = useState(() =>
    typeof window === 'undefined' ? 320 : mobileDrawerWidth(window.innerWidth),
  )
  const mobileNavProgressRef = useRef(0)
  const mobileNavDrag = useRef<MobileDrawerDrag | null>(null)
  const mobileDrawerHostRef = useRef<HTMLDivElement>(null)
  const mobileDrawerScheduler = useRef<ReturnType<typeof createDrawerFrameScheduler> | null>(null)
  const suppressClick = useRef(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [launcherOpen, setLauncherOpen] = useState(false)
  const [composerKind, setComposerKind] = useState<ComposerKind | null>(null)
  const composerAnchorRef = useRef<HTMLElement | null>(null)
  const [creationReveal, setCreationReveal] = useState<{
    kind: ComposerKind
    id: string
  } | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [undoVisible, setUndoVisible] = useState(false)
  const undoTimer = useRef<number | null>(null)

  useEffect(() => {
    saveView(view)
  }, [view])

  useEffect(() => {
    if (!isComposerLauncherView(view)) setLauncherOpen(false)
  }, [view])

  useEffect(() => {
    if (!creationReveal || view !== composerDestination(creationReveal.kind)) return
    const frame = window.requestAnimationFrame(() => {
      const element = [...document.querySelectorAll<HTMLElement>('[data-clarity-entity]')].find(
        (candidate) => candidate.dataset.clarityEntity === `${creationReveal.kind}:${creationReveal.id}`,
      )
      if (!element) return
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      element.classList.add('creation-reveal')
      window.setTimeout(() => {
        element.classList.remove('creation-reveal')
        setCreationReveal(null)
      }, 1_200)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [creationReveal, habits, notes, tasks, view])

  // Handle deleted list: fall back to inbox if the current view vanishes.
  // Waits for the store, or a restored list view would be bounced on load,
  // before the lists it names have arrived.
  useEffect(() => {
    if (!store.ready) return
    if (view.startsWith('list:') && !lists.some((l) => `list:${l.id}` === view)) {
      setView('inbox')
    }
  }, [lists, view, store.ready])

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

  // Reminder sweep. A minute is fine granularity for a wall-clock nudge, and
  // the sweep itself is cheap and deduplicated.
  useEffect(() => {
    const tick = () => checkReminders(tasks, habits)
    tick()
    const id = window.setInterval(tick, 60_000)
    // Coming back to the tab should catch anything that came due while hidden.
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [tasks, habits])

  // Native reminders are owned by iOS rather than this foreground timer. Any
  // task/habit edit, app resume, or newly granted permission reconciles the
  // pending OS schedule.
  useEffect(() => {
    const sync = () => syncNativeReminders(tasks, habits)
    const onVisible = () => {
      if (document.visibilityState === 'visible') sync()
    }
    sync()
    window.addEventListener('clarity:native-notifications-enabled', sync)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('clarity:native-notifications-enabled', sync)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [tasks, habits])

  // The global key handler is bound once; read the live view through a ref.
  const viewRef = useRef(view)
  useEffect(() => {
    viewRef.current = view
  }, [view])

  const openQuickAdd = useCallback(() => {
    nativeSelectionHaptic()
    setQuickAddOpen(true)
  }, [])
  const chooseComposer = useCallback((kind: ComposerKind, anchor: HTMLButtonElement) => {
    composerAnchorRef.current = anchor
    setComposerKind(kind)
    // Let the selected action remain at its fanned position for the modal's
    // layout measurement, then collapse the menu on the next painted frame.
    window.requestAnimationFrame(() => setLauncherOpen(false))
  }, [])
  const finishCreation = useCallback((kind: ComposerKind, id: string) => {
    setComposerKind(null)
    setLauncherOpen(false)
    setCreationReveal({ kind, id })
    if (kind === 'note') setNoteTag(null)
    setView(composerDestination(kind))
    nativeSuccessHaptic()
  }, [])
  const navigateTo = useCallback((nextView: ViewId) => {
    nativeSelectionHaptic()
    setView(nextView)
  }, [])
  const addTaskFromComposer = useCallback(
    (input: TaskDraftInput, autosavedTaskId?: string) => {
      const taskId = autosavedTaskId ?? addTask({ ...input, favorite: view === 'favorites' }).id
      if (autosavedTaskId) updateTask(autosavedTaskId, input)
      setQuickAddOpen(false)
      if (composerKind === 'task') finishCreation('task', taskId)
    },
    [addTask, composerKind, finishCreation, updateTask, view],
  )
  const autosaveTaskFromComposer = useCallback(
    (input: TaskDraftInput, taskId: string | null) => {
      if (taskId) {
        updateTask(taskId, input)
        return taskId
      }
      return addTask({ ...input, favorite: view === 'favorites' }).id
    },
    [addTask, updateTask, view],
  )
  const writeDrawerMotion = useCallback((motion: DrawerMotion) => {
    const host = mobileDrawerHostRef.current
    if (!host) return
    host.style.setProperty('--mobile-page-x', `${motion.pageX}px`)
    host.style.setProperty('--mobile-page-scale', `${motion.pageScale}`)
    host.style.setProperty('--mobile-page-radius', `${motion.pageRadius}px`)
    host.style.setProperty('--mobile-drawer-x', `${motion.drawerX}px`)
    host.style.setProperty('--mobile-scrim-opacity', `${motion.scrimOpacity}`)
  }, [])
  const ensureDrawerScheduler = useCallback(() => {
    if (!mobileDrawerScheduler.current) {
      mobileDrawerScheduler.current = createDrawerFrameScheduler({
        requestFrame: (callback) => window.requestAnimationFrame(callback),
        cancelFrame: (handle) => window.cancelAnimationFrame(handle),
        write: writeDrawerMotion,
      })
    }
    return mobileDrawerScheduler.current
  }, [writeDrawerMotion])
  const setDrawerProgress = useCallback((progress: number) => {
    mobileNavProgressRef.current = progress
    ensureDrawerScheduler().schedule(progress, mobileNavWidth)
  }, [ensureDrawerScheduler, mobileNavWidth])
  const settleDrawer = useCallback(
    (targetProgress: 0 | 1, velocityX = 0) => {
      const startProgress = mobileNavProgressRef.current
      const host = mobileDrawerHostRef.current
      const scheduler = ensureDrawerScheduler()

      // Paint the final finger position before transitions are restored. This
      // prevents a queued pointer frame from landing after the settle begins.
      scheduler.flush(startProgress, mobileNavWidth)
      if (host) {
        host.dataset.drawerDragging = 'false'
        host.style.setProperty(
          '--mobile-settle-duration',
          `${drawerSettleDuration(startProgress, targetProgress, velocityX, mobileNavWidth)}ms`,
        )
        // Commit the drag transform before the target is queued for the next
        // display frame, otherwise WebKit may merge both writes and skip it.
        void host.offsetWidth
      }
      setDrawerProgress(targetProgress)
    },
    [ensureDrawerScheduler, mobileNavWidth, setDrawerProgress],
  )
  const openMobileNav = useCallback(() => {
    setLauncherOpen(false)
    setMobileNavOpen(true)
    settleDrawer(1)
  }, [settleDrawer])
  const closeMobileNav = useCallback(() => {
    setMobileNavOpen(false)
    settleDrawer(0)
  }, [settleDrawer])
  const openSearch = useCallback(() => {
    searchRef.current?.focus()
    searchRef.current?.select()
  }, [])

  useEffect(() => {
    return () => mobileDrawerScheduler.current?.cancel()
  }, [])

  useEffect(() => {
    const syncDrawerWidth = () => {
      const width = mobileDrawerWidth(window.innerWidth)
      setMobileNavWidth(width)
      ensureDrawerScheduler().flush(mobileNavProgressRef.current, width)
      if (window.innerWidth >= 768) closeMobileNav()
    }
    window.addEventListener('resize', syncDrawerWidth)
    return () => window.removeEventListener('resize', syncDrawerWidth)
  }, [closeMobileNav, ensureDrawerScheduler])

  useEffect(() => {
    if (!mobileNavOpen) return
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMobileNav()
    }
    document.addEventListener('keydown', onEscape)
    return () => document.removeEventListener('keydown', onEscape)
  }, [closeMobileNav, mobileNavOpen])

  // A view that cannot accept a task must never leave an inaccessible composer
  // open after navigation (for example, from Inbox to Settings or Notes).
  useEffect(() => {
    if (!acceptsNewTask(view)) setQuickAddOpen(false)
  }, [view])

  const onDrawerPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (
      window.innerWidth >= 768 ||
      !event.isPrimary ||
      event.button !== 0 ||
      launcherOpen ||
      composerKind !== null
    )
      return

    const progress = mobileNavProgressRef.current
    const target = event.target as HTMLElement
    const interactiveTarget = Boolean(
      target.closest(
        'button, a, input, textarea, select, [contenteditable="true"], [role="dialog"], [data-drawer-gesture-lock]',
      ),
    )
    if (
      !canStartDrawerDrag({
        progress,
        startX: event.clientX,
        interactiveTarget,
      })
    )
      return

    mobileNavDrag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastTime: event.timeStamp,
      originProgress: progress,
      progress,
      velocityX: 0,
      axis: 'pending',
    }
  }, [composerKind, launcherOpen])

  const onDrawerPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = mobileNavDrag.current
      if (!drag || drag.pointerId !== event.pointerId) return

      const deltaX = event.clientX - drag.startX
      const deltaY = event.clientY - drag.startY
      if (drag.axis === 'pending') {
        drag.axis = dragDirection(deltaX, deltaY)
        if (drag.axis === 'vertical') {
          mobileNavDrag.current = null
          return
        }
        if (drag.axis === 'pending') return
        event.currentTarget.setPointerCapture(event.pointerId)
        event.currentTarget.dataset.drawerDragging = 'true'
        setMobileNavDragging(true)
      }

      event.preventDefault()
      const elapsed = event.timeStamp - drag.lastTime
      if (elapsed > 0) drag.velocityX = (event.clientX - drag.lastX) / elapsed
      drag.lastX = event.clientX
      drag.lastTime = event.timeStamp
      drag.progress = drawerProgress(drag.originProgress, deltaX, mobileNavWidth)
      setDrawerProgress(drag.progress)
    },
    [mobileNavWidth, setDrawerProgress],
  )

  const finishDrawerDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = mobileNavDrag.current
      if (!drag || drag.pointerId !== event.pointerId) return
      mobileNavDrag.current = null
      if (drag.axis !== 'horizontal') return

      const elapsed = event.timeStamp - drag.lastTime
      drag.velocityX = drawerReleaseVelocity(
        drag.velocityX,
        event.clientX - drag.lastX,
        elapsed,
      )

      suppressClick.current = true
      window.setTimeout(() => {
        suppressClick.current = false
      }, 0)
      setMobileNavDragging(false)
      const willOpen = shouldOpenDrawer(drag.progress, drag.velocityX)
      setMobileNavOpen(willOpen)
      settleDrawer(willOpen ? 1 : 0, drag.velocityX)
    },
    [settleDrawer],
  )

  // Global keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const typing =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
        return
      }
      if (typing) return
      if (e.key === '/') {
        e.preventDefault()
        searchRef.current?.focus()
      } else if (e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (compactTaskEntry) {
          if (!isComposerLauncherView(viewRef.current)) return
          const taskAction = document.querySelector<HTMLButtonElement>(
            '.composer-launcher-action[aria-label="New task"]',
          )
          if (!taskAction) return
          e.preventDefault()
          composerAnchorRef.current = taskAction
          setComposerKind('task')
          return
        }
        if (!acceptsNewTask(viewRef.current)) return
        e.preventDefault()
        nativeSelectionHaptic()
        setQuickAddOpen(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [compactTaskEntry])

  const visibleTasks = useMemo(() => {
    let result = tasksForView(tasks, view)
    result = applyFilters(result, filters)
    if (inlineQuery.trim()) {
      result = applySearch(result, inlineQuery, lists)
    }
    return sortTasks(result, sort)
  }, [tasks, view, filters, sort, inlineQuery, lists])

  const defaultListId = view.startsWith('list:') ? view.slice(5) : null
  const editingTaskPresence = usePresenceValue(editingTask)
  const settingsPresence = usePresenceValue(settingsOpen ? true : null)
  const routineComposerPresence = usePresenceValue(composerKind === 'routine' ? true : null, {
    onExited: () => composerAnchorRef.current?.focus(),
  })
  const undoPresence = usePresenceValue(
    undoVisible && store.lastDeleted ? store.lastDeleted.task.title : null,
  )
  const defaultDueDate =
    view === 'today' ? todayStr() : view === 'upcoming' ? addDays(todayStr(), 1) : null

  const subtitle =
    view === 'today'
      ? new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
      : undefined

  const presetKey = view.startsWith('list:') ? 'list' : (view as keyof typeof EMPTY_PRESETS)
  const preset = EMPTY_PRESETS[presetKey] ?? EMPTY_PRESETS.inbox
  const filtered = isFilterActive(filters) || inlineQuery.trim() !== ''

  return (
    <>
 <div
      ref={mobileDrawerHostRef}
      className="app-shell mobile-drawer-host flex h-dvh overflow-hidden bg-bg text-ink"
      inert={(quickAddOpen && compactTaskEntry) || composerKind !== null}
      data-drawer-active={mobileNavOpen || mobileNavDragging}
      data-drawer-dragging={mobileNavDragging}
      style={{ '--mobile-drawer-width': `${mobileNavWidth}px` } as CSSProperties}
      onPointerDown={onDrawerPointerDown}
      onPointerMove={onDrawerPointerMove}
      onPointerUp={finishDrawerDrag}
      onPointerCancel={finishDrawerDrag}
      onClickCapture={(event) => {
        if (!suppressClick.current) return
        event.preventDefault()
        event.stopPropagation()
      }}
    >
      <Sidebar
        view={view}
        tasks={tasks}
        lists={lists}
        mobileOpen={mobileNavOpen}
        mobileDragging={mobileNavDragging}
        mobileWidth={mobileNavWidth}
        onNavigate={(v) => {
          navigateTo(v)
          setInlineQuery('')
        }}
        onCloseMobile={closeMobileNav}
        onBackdropClick={() => {
          if (!suppressClick.current) closeMobileNav()
        }}
        onAddList={(name, color) => store.addList(name, color)}
        onUpdateList={(id, patch) => store.updateList(id, patch)}
        onDeleteList={(id) => store.deleteList(id)}
        onOpenSettings={() => {
          nativeSelectionHaptic()
          setSettingsOpen(true)
        }}
        noteCount={notes.length}
        habitCount={
          // Writing is counted under Notes, where its grid now lives.
          habits.filter((h) => h.archivedAt === null && h.source !== 'notes').length
        }
        habitFilter={habitFilter}
        onHabitFilter={setHabitFilter}
        templates={templates}
        onUseTemplate={(t) => {
          setEditTemplate(null)
          setSeedTemplate(t)
          navigateTo('habits')
        }}
        onEditTemplate={(t) => {
          setSeedTemplate(null)
          setEditTemplate(t)
          navigateTo('habits')
        }}
        onDeleteTemplate={(t) => {
          if (window.confirm(`Delete the “${t.name}” template? Routines built from it are kept.`)) {
            nativeWarningHaptic()
            deleteTemplate(t.id)
          }
        }}
        noteTags={noteTags}
        noteTag={noteTag}
        onNoteTag={setNoteTag}
      />

      <div
        className="mobile-page relative z-10 flex min-w-0 flex-1 overflow-hidden"
        inert={mobileNavOpen && !mobileNavDragging}
      >
      {/* The column scrolls; the search bar below it does not. Keeping the bar
          a flex child rather than a fixed overlay is what makes it docked
          instead of floating — it can never cover the page's last row, and on a
          wide screen it stops at the sidebar rather than running under it. */}
 <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-x-hidden overflow-y-auto">
 <div
            key={view}
            className={`motion-page mx-auto w-full px-4 sm:px-6 ${
              view === 'habits' ? 'max-w-5xl' : 'max-w-2xl'
            } ${
              // Notes lays itself out as a column that fills the height, so the
              // Earlier panel can take whatever is left and scroll inside it —
              // its search field then sits on screen rather than below the fold.
              // It still overflows and scrolls the page when the composer and
              // the streak leave the panel less than its minimum. The generous
              // bottom padding elsewhere is clearance for the floating add
              // button, which this view does not have; here it would only eat
              // into the panel.
              view === 'notes' ? 'flex h-full flex-col pb-4' : 'pb-20 sm:pb-12'
            }`}
          >
          {view === 'home' ? (
            <Home
              tasks={tasks}
              lists={lists}
              onOpenMobileNav={openMobileNav}
              onNavigate={navigateTo}
              onOpenNote={(id) => {
                setNoteTag(null)
                navigateTo('notes')
                setOpenNoteId(id)
              }}
              onEditTask={(t) => setEditingTask(t)}
              store={store}
            />
          ) : view === 'habits' ? (
            <HabitTracker
              onOpenMobileNav={openMobileNav}
              filter={habitFilter}
              seedTemplate={seedTemplate}
              editTemplate={editTemplate}
              onTemplateHandled={() => {
                setSeedTemplate(null)
                setEditTemplate(null)
              }}
            />
          ) : view === 'guide' ? (
            <Guide onOpenMobileNav={openMobileNav} onNavigate={navigateTo} />
          ) : view === 'notes' ? (
            <BrainDump
              onOpenMobileNav={openMobileNav}
              tagFilter={noteTag}
              onTagFilter={setNoteTag}
              openNoteId={openNoteId}
              onNoteOpened={() => setOpenNoteId(null)}
            />
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
            onOpenMobileNav={openMobileNav}
            onAddTask={openQuickAdd}
          />

          {/* Inline search (visible when typing via palette is bypassed) */}
          {inlineQuery && (
 <div className="motion-content mb-3 flex items-center gap-2 rounded-xl border border-accent/40 bg-accent-soft px-3 py-2 text-sm text-accent">
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

          {/* The list gets the same panel Notes and Home use. Upcoming is the
              one exception: it already groups by date, so each date gets its
              own panel with the day as the heading rather than one long box
              with headings floating inside it. */}
          {visibleTasks.length === 0 ? (
            <Panel>
              <PanelBody>
                {filtered ? (
                  <EmptyState {...EMPTY_PRESETS.search} />
                ) : (
                  <EmptyState {...preset} />
                )}
              </PanelBody>
            </Panel>
          ) : view === 'trash' ? (
            <Panel label="Deleted tasks">
              <PanelBody>
                <TrashRows tasks={visibleTasks} lists={lists} store={store} />
              </PanelBody>
            </Panel>
          ) : view === 'upcoming' ? (
            <UpcomingGroups
              tasks={visibleTasks}
              lists={lists}
              onEdit={setEditingTask}
              store={store}
            />
          ) : (
            <Panel label="Tasks">
              <PanelBody>
                <TaskRows tasks={visibleTasks} lists={lists} onEdit={setEditingTask} store={store} />
              </PanelBody>
            </Panel>
          )}

          {/* Completed section (non-completed views) */}
          {view !== 'completed' && view !== 'trash' && (
            <CompletedSection lists={lists} onEdit={setEditingTask} store={store} view={view} />
          )}

          {/* Quick add. Under the list rather than over it, so the page reads
              top to bottom as what is already there, then the place to add. */}
          {!compactTaskEntry && acceptsNewTask(view) && (
 <div className="mt-6">
              <TaskInput
                key={`${view}-${quickAddOpen}`}
                lists={lists}
                defaultListId={defaultListId}
                defaultDueDate={defaultDueDate}
                autoFocus={quickAddOpen}
                onCancel={() => setQuickAddOpen(false)}
                onSubmit={addTaskFromComposer}
              />
            </div>
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
                    nativeWarningHaptic()
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
        </div>

        <div className="native-search-dock relative shrink-0">
          <GlobalSearch
            tasks={tasks}
            lists={lists}
            notes={notes}
            inputRef={searchRef}
            onSelectTask={(task) => setEditingTask(task)}
            onSelectNote={(note) => {
              setNoteTag(null)
              navigateTo('notes')
              setOpenNoteId(note.id)
            }}
            trailing={
              isComposerLauncherView(view) ? (
                <MobileComposerLauncher
                  variant={isNativeApp ? 'native' : 'web'}
                  open={launcherOpen}
                  onOpenChange={setLauncherOpen}
                  onChoose={chooseComposer}
                />
              ) : undefined
            }
          />
        </div>
      </main>
      </div>

      {editingTaskPresence && (
        <TaskEditor
          task={editingTaskPresence.value}
          lists={lists}
          onSave={(patch) => store.updateTask(editingTaskPresence.value.id, patch)}
          onDelete={() => store.deleteTask(editingTaskPresence.value.id)}
          onClose={() => setEditingTask(null)}
          phase={editingTaskPresence.phase}
        />
      )}

      {settingsPresence && (
        <Settings
          onClose={() => setSettingsOpen(false)}
          onOpenGuide={() => navigateTo('guide')}
          phase={settingsPresence.phase}
        />
      )}

      {undoPresence && (
        <UndoToast
          title={undoPresence.value}
          phase={undoPresence.phase}
          onUndo={() => {
            nativeSelectionHaptic()
            store.undoDelete()
            setUndoVisible(false)
          }}
        />
      )}
      </div>
      <TaskComposerModal
        open={composerKind === 'task'}
        anchorRef={composerAnchorRef}
        lists={lists}
        defaultListId={defaultListId}
        defaultDueDate={defaultDueDate}
        onAutosave={autosaveTaskFromComposer}
        onSubmit={addTaskFromComposer}
        onClose={() => {
          setQuickAddOpen(false)
          if (composerKind === 'task') setComposerKind(null)
        }}
      />

      {routineComposerPresence && (
        <HabitForm
          templates={templates}
          anchorRef={composerAnchorRef}
          onSaveTemplate={(draft) => saveAsTemplate(draft as Habit)}
          onDeleteTemplate={deleteTemplate}
          onSave={(draft) => {
            const routine = addHabit(draft)
            finishCreation('routine', routine.id)
          }}
          onClose={() => setComposerKind(null)}
          phase={routineComposerPresence.phase}
        />
      )}

      <NoteComposerModal
        open={composerKind === 'note'}
        anchorRef={composerAnchorRef}
        onCreated={(id) => finishCreation('note', id)}
        onClose={() => setComposerKind(null)}
      />
    </>
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
      {tasks.map((t, index) => (
        <li key={t.id}>
          <TaskItem
            task={t}
            motionIndex={index}
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
 <div className="space-y-4">
      {groups.map((g) => (
        <Panel key={g.date} label={sectionLabel(g.date)}>
          <PanelHeader>
            <span
              className={`label ${isOverdue(g.date) ? 'text-danger' : ''}`}
            >
              {isOverdue(g.date) ? 'Overdue · ' : ''}
              {sectionLabel(g.date)}
            </span>
            <span className="ml-auto font-mono text-3xs text-faint tabular-nums">
              {g.tasks.length}
            </span>
          </PanelHeader>
          <PanelBody>
            <TaskRows tasks={g.tasks} lists={lists} onEdit={onEdit} store={store} />
          </PanelBody>
        </Panel>
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
                      nativeWarningHaptic()
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

  // The disclosure is the panel's heading row, so a collapsed section is just a
  // panel with nothing under its header rather than a stray button on the page.
  return (
    <Panel className="mt-4">
      <PanelHeader className={expanded ? '' : 'border-b-0'}>
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className="-mx-1 flex flex-1 cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-left transition-colors hover:text-ink"
        >
          <span
            className={`label inline-block transition-transform ${expanded ? 'rotate-90' : ''}`}
            aria-hidden
          >
            ›
          </span>
          <span className="label">Completed</span>
          <span className="font-mono text-3xs text-faint tabular-nums">{completed.length}</span>
        </button>
      </PanelHeader>
      {expanded && (
        <PanelBody className="anim-fade-slide-in p-2">
          <TaskRows tasks={completed} lists={lists} onEdit={onEdit} store={store} />
        </PanelBody>
      )}
    </Panel>
  )
}

export default function App() {
  return (
    <AuthGate>
      <AppShell />
    </AuthGate>
  )
}
