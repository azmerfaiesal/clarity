import { ArrowRight, Check, Menu } from 'lucide-react'
import { useMemo } from 'react'
import type { Habit, Task, TaskList, ViewId } from '../types'
import { useHabits } from '../store/habitStore'
import { useNotes } from '../store/noteStore'
import { formatRelative, todayStr } from '../utils/dateUtils'
import type { WeekStart } from '../utils/habitUtils'
import { formatAmount, habitStats, isCompletedOn } from '../utils/habitUtils'
import { useWeekStart } from '../store/theme'
import { FlameIcon } from './FlameIcon'
import { HabitIcon } from './HabitIcon'
import { TaskItem } from './TaskItem'

/**
 * Today at a glance across the three trackers. Deliberately a summary and not a
 * second place to manage things: everything here links through to the section
 * that owns it, so there is one place to edit each kind of thing.
 */
export function Home({
  tasks,
  lists,
  onOpenMobileNav,
  onNavigate,
  onEditTask,
  store,
}: {
  tasks: Task[]
  lists: TaskList[]
  onOpenMobileNav: () => void
  onNavigate: (v: ViewId) => void
  onEditTask: (t: Task) => void
  store: {
    toggleComplete: (id: string) => void
    deleteTask: (id: string) => void
    toggleFavorite: (id: string) => void
    duplicateTask: (id: string) => void
  }
}) {
  const { habits, toggleCompletion, adjustCompletion } = useHabits()
  const { notes } = useNotes()
  const today = todayStr()
  const firstDay = useWeekStart()

  const dueTasks = useMemo(
    () =>
      tasks
        .filter((t) => !t.completed && t.deletedAt === null && t.dueDate !== null && t.dueDate <= today)
        .slice(0, 5),
    [tasks, today],
  )

  const dueHabits = useMemo(
    () => habits.filter((h) => h.archivedAt === null && habitStats(h, today, firstDay).dueToday),
    [habits, today, firstDay],
  )
  const habitsDone = dueHabits.filter((h) => isCompletedOn(h, today)).length

  const recentNotes = useMemo(() => notes.slice(0, 3), [notes])

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 18) return 'Good afternoon'
    return 'Good evening'
  })()

  return (
    <>
      <header className="flex items-center gap-2 pt-6 pb-6 sm:pt-10">
        <button
          type="button"
          onClick={onOpenMobileNav}
          aria-label="Open navigation"
          className="-ml-1 cursor-pointer rounded-md p-2 text-muted transition-colors hover:bg-surface hover:text-ink md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold tracking-[-0.02em] text-ink sm:text-2xl">
            {greeting}
          </h1>
          <p className="mt-1 font-mono text-2xs tracking-[0.06em] text-faint uppercase">
            {new Date().toLocaleDateString(undefined, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
        </div>
      </header>

      {/* Habits */}
      <Section
        title="Habits"
        meta={dueHabits.length > 0 ? `${habitsDone}/${dueHabits.length} done` : undefined}
        onOpen={() => onNavigate('habits')}
      >
        {dueHabits.length === 0 ? (
          <Blank>Nothing scheduled today.</Blank>
        ) : (
          <ul className="space-y-1" role="list">
            {dueHabits.map((h) => (
              <HomeHabitRow
                key={h.id}
                habit={h}
                today={today}
                firstDay={firstDay}
                onToggle={() =>
                  h.trackBy !== 'checkoff'
                    ? adjustCompletion(h.id, h.trackBy === 'duration' ? 5 : 1)
                    : toggleCompletion(h.id)
                }
              />
            ))}
          </ul>
        )}
      </Section>

      {/* Tasks */}
      <Section
        title="Due today"
        meta={dueTasks.length > 0 ? `${dueTasks.length}` : undefined}
        onOpen={() => onNavigate('today')}
      >
        {dueTasks.length === 0 ? (
          <Blank>Nothing due. Enjoy it.</Blank>
        ) : (
          <ul className="space-y-0.5" role="list">
            {dueTasks.map((t) => (
              <li key={t.id}>
                <TaskItem
                  task={t}
                  lists={lists}
                  onEdit={() => onEditTask(t)}
                  onDelete={() => store.deleteTask(t.id)}
                  onToggleComplete={() => store.toggleComplete(t.id)}
                  onToggleFavorite={() => store.toggleFavorite(t.id)}
                  onDuplicate={() => store.duplicateTask(t.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Notes */}
      <Section title="Recent notes" onOpen={() => onNavigate('notes')}>
        {recentNotes.length === 0 ? (
          <Blank>Nothing written yet.</Blank>
        ) : (
          <ul className="space-y-0.5" role="list">
            {recentNotes.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => onNavigate('notes')}
                  className="w-full cursor-pointer rounded-md px-2 py-2 text-left transition-colors hover:bg-surface"
                >
                  <p className="line-clamp-1 text-sm text-ink">
                    {n.content.replace(/\s+/g, ' ').trim()}
                  </p>
                  <p className="mt-0.5 font-mono text-3xs text-faint">
                    {formatRelative(n.createdAt)}
                    {n.tags.length > 0 && ` · ${n.tags.join(', ')}`}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  )
}

function Section({
  title,
  meta,
  onOpen,
  children,
}: {
  title: string
  meta?: string
  onOpen: () => void
  children: React.ReactNode
}) {
  return (
    <section className="mb-8">
      <div className="mb-2 flex items-center gap-2">
        <span className="label">{title}</span>
        {meta && <span className="font-mono text-3xs text-faint">{meta}</span>}
        <button
          type="button"
          onClick={onOpen}
          className="ml-auto inline-flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 font-mono text-3xs text-faint transition-colors hover:text-accent"
        >
          Open <ArrowRight className="h-3 w-3" />
        </button>
      </div>
      {children}
    </section>
  )
}

function Blank({ children }: { children: React.ReactNode }) {
  return <p className="px-2 py-3 text-sm text-faint">{children}</p>
}

function HomeHabitRow({
  habit,
  today,
  firstDay,
  onToggle,
}: {
  habit: Habit
  today: string
  firstDay: WeekStart
  onToggle: () => void
}) {
  const s = habitStats(habit, today, firstDay)
  const done = s.doneToday
  return (
    <li className="flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-surface">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={done}
        aria-label={done ? `Undo ${habit.name}` : `Mark ${habit.name} complete`}
        className={`flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border transition-all ${
          done ? 'border-transparent' : 'border-dashed border-line'
        }`}
        style={done ? { backgroundColor: habit.color, color: 'var(--bg)' } : { color: habit.color }}
      >
        {done ? (
          <Check className="h-4 w-4" strokeWidth={3} />
        ) : habit.trackBy !== 'checkoff' ? (
          <span className="font-mono text-[9px] tabular-nums">
            {formatAmount(habit, s.amountToday)}
          </span>
        ) : (
          <HabitIcon icon={habit.icon} className="h-3.5 w-3.5" fallback={<span>·</span>} />
        )}
      </button>
      <span className={`min-w-0 flex-1 truncate text-sm ${done ? 'text-muted line-through' : 'text-ink'}`}>
        {habit.name}
      </span>
      <span className="flex shrink-0 items-center gap-1 font-mono text-3xs text-faint tabular-nums">
        <FlameIcon
          className="h-3 w-3"
          beaming={s.current > 0}
          color={s.current > 0 ? habit.color : undefined}
          streak={s.current}
          peak={habit.targetStreak ?? 30}
        />
        {s.current}
      </span>
    </li>
  )
}
