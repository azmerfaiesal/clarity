import {
  Archive,
  ArchiveRestore,
  BookmarkPlus,
  Check,
  GripVertical,
  Minus,
  MoreHorizontal,
  Pencil,
  PenLine,
  Plus,
  Trash2,
} from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Habit } from '../types'
import { todayStr } from '../utils/dateUtils'
import { formatAmount, habitStats, repetitionLabel, totalAmount } from '../utils/habitUtils'
import { useWeekStart } from '../store/theme'
import { AmountSlider } from './AmountSlider'
import { FlameIcon } from './FlameIcon'
import { HabitIcon } from './HabitIcon'
import { Dropdown, MenuDivider, MenuItem } from './Dropdown'
import { HabitMonthRows, HeatmapLegend } from './HabitHeatmap'
import { loadHabitRange, saveHabitRange } from '../store/storage'
import { nativeSelectionHaptic, nativeSuccessHaptic } from '../native/platform'
import { usePresenceValue } from './MotionPresence'
import type { DayDetailAnchor } from './DayDetail'

type Range = 'month' | 'fourMonths' | 'twelveMonths'
const RANGE_HEIGHT_MOTION_MS = 520

/**
 * One habit: a large check to log today on the left, the streak and lifetime
 * total on the right, and its history underneath.
 */
export function HabitCard({
  habit,
  onToggle,
  onAdjust,
  onEdit,
  onDelete,
  onArchive,
  justCompleted,
  onSetAmount,
  onSaveTemplate,
  onOpenSummary,
  onPickDay,
  onSetNotes,
  burstDate,
  dragHandleProps,
  dragging,
  motionIndex = 0,
}: {
  habit: Habit
  onToggle: (date?: string) => void
  /** Add or remove one log, for habits that count. */
  onAdjust: (delta: number, date?: string) => void
  onEdit: () => void
  onDelete: () => void
  onArchive: (archived: boolean) => void
  justCompleted: boolean
  onSetAmount: (amount: number, date?: string) => void
  onSaveTemplate: () => void
  onOpenSummary: (anchor: HTMLElement) => void
  onPickDay: (date: string, anchor: DayDetailAnchor) => void
  onSetNotes: (date: string, notes: string[]) => void
  /** A day just finished on this habit — its box lets off a firework. */
  burstDate?: string | null
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>
  dragging?: boolean
  motionIndex?: number
}) {
  const [sliderOpen, setSliderOpen] = useState(false)
  const sliderPresence = usePresenceValue(sliderOpen ? true : null)
  const cardRef = useRef<HTMLElement>(null)
  const detailRailRef = useRef<HTMLDivElement>(null)
  const rangeStartHeightRef = useRef<number | null>(null)
  const rangeMotionCleanupRef = useRef<(() => void) | null>(null)
  // Which span of history the card is showing. Per card, not global — one
  // habit is worth reading a year of while another only matters this month —
  // and remembered, so the choice survives leaving the page.
  const [range, setRange] = useState<Range>(() => {
    const saved = loadHabitRange(habit.id)
    if (saved === 'month') return 'month'
    if (saved === 'fourMonths' || saved === 'quarter') return 'fourMonths'
    return 'twelveMonths'
  })
  const pickRange = (r: Range) => {
    if (r === range) return
    rangeStartHeightRef.current = cardRef.current?.getBoundingClientRect().height ?? null
    setRange(r)
    saveHabitRange(habit.id, r)
  }

  useLayoutEffect(() => {
    const element = cardRef.current
    const fromHeight = rangeStartHeightRef.current
    rangeStartHeightRef.current = null
    if (!element || fromHeight === null) return

    rangeMotionCleanupRef.current?.()
    const toHeight = element.getBoundingClientRect().height
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (Math.abs(fromHeight - toHeight) < 1 || reducedMotion) return

    let frameId: number | null = null
    let fallbackId: number | null = null
    const onTransitionEnd = (event: TransitionEvent) => {
      if (event.propertyName === 'height') cleanup()
    }
    const cleanup = () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId)
      if (fallbackId !== null) window.clearTimeout(fallbackId)
      element.removeEventListener('transitionend', onTransitionEnd)
      element.style.height = ''
      delete element.dataset.rangeMotion
      if (rangeMotionCleanupRef.current === cleanup) rangeMotionCleanupRef.current = null
    }

    element.style.height = `${fromHeight}px`
    element.dataset.rangeMotion = 'running'
    element.addEventListener('transitionend', onTransitionEnd)
    frameId = window.requestAnimationFrame(() => {
      element.style.height = `${toHeight}px`
      fallbackId = window.setTimeout(cleanup, RANGE_HEIGHT_MOTION_MS + 100)
    })
    rangeMotionCleanupRef.current = cleanup
  }, [range])

  useEffect(() => () => rangeMotionCleanupRef.current?.(), [])
  const holdTimer = useRef<number | null>(null)
  const heldRef = useRef(false)
  const today = todayStr()
  const firstDay = useWeekStart()
  const s = habitStats(habit, today, firstDay)
  const archived = habit.archivedAt !== null
  const canTick = s.dueToday && !archived
  const counted = habit.trackBy !== 'checkoff'
  const fromNotes = habit.source === 'notes'

  // Press and hold opens the slider; a short press just logs one.
  const startHold = () => {
    if (!canTick || !counted) return
    heldRef.current = false
    holdTimer.current = window.setTimeout(() => {
      heldRef.current = true
      setSliderOpen(true)
    }, 400)
  }
  const endHold = () => {
    if (holdTimer.current) window.clearTimeout(holdTimer.current)
    holdTimer.current = null
  }

  const pickDay = (date: string, anchor: { x: number; y: number }) => {
    const railBox = detailRailRef.current?.getBoundingClientRect()
    if (railBox && railBox.width > 0 && railBox.height > 0) {
      onPickDay(date, {
        ...anchor,
        rail: {
          left: railBox.left,
          top: railBox.top,
          width: railBox.width,
          height: railBox.height,
        },
      })
      return
    }
    onPickDay(date, anchor)
  }

  return (
    <article
      ref={cardRef}
      data-clarity-entity={`routine:${habit.id}`}
      className={`routine-card motion-content min-w-0 max-w-full rounded-xl border bg-raised px-4 py-4 transition-colors sm:px-5 ${
        justCompleted ? 'border-success' : 'border-line'
      } ${archived ? 'opacity-60' : ''}`}
      style={
        {
          '--motion-index': Math.min(motionIndex, 7),
          ...(justCompleted ? { boxShadow: `0 0 22px -8px ${habit.color}` } : {}),
        } as React.CSSProperties
      }
    >
      <div className="flex items-start gap-3">
        {/* Drag handle */}
        <button
          type="button"
          {...dragHandleProps}
          aria-label={`Reorder ${habit.name}`}
          title="Drag to reorder"
          className={`motion-interactive mt-3 hidden shrink-0 cursor-grab touch-none rounded text-faint hover:text-muted active:cursor-grabbing sm:block ${
            dragging ? 'text-accent' : ''
          }`}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        {/* Today's log. Counted and timed habits add one step per tap and open
            a slider on hold; checkoff habits simply toggle. */}
        <div className="relative mt-0.5 flex shrink-0 flex-col items-center gap-1">
          <button
            type="button"
            disabled={!canTick || fromNotes}
            onPointerDown={startHold}
            onPointerUp={endHold}
            onPointerLeave={endHold}
            onClick={() => {
              if (heldRef.current) {
                heldRef.current = false
                return
              }
              if (counted) {
                const step = habit.trackBy === 'duration' ? 5 : 1
                onAdjust(step)
              } else {
                if (s.doneToday) nativeSelectionHaptic()
                else nativeSuccessHaptic()
                onToggle()
              }
            }}
            aria-pressed={s.doneToday}
            aria-label={
              fromNotes
                ? `${habit.name} ticks itself when you write a note`
                : !canTick
                  ? `${habit.name} — not scheduled today`
                  : counted
                    ? `Log for ${habit.name} — ${formatAmount(habit, s.amountToday)} of ${formatAmount(habit, s.needPerDay)} today. Hold to set an exact amount.`
                    : s.doneToday
                      ? `Undo today's completion of ${habit.name}`
                      : `Mark ${habit.name} complete for today`
            }
            title={
              fromNotes
                ? 'Ticks itself when you write a note'
                : !canTick
                  ? 'Not scheduled today'
                  : counted
                    ? 'Tap to add · hold to set exactly'
                    : s.doneToday
                      ? 'Done today · undo'
                      : 'Mark complete'
            }
            className={`motion-interactive flex h-11 w-11 items-center justify-center rounded-xl border disabled:cursor-not-allowed disabled:opacity-40 ${
              canTick && !fromNotes ? 'cursor-pointer' : ''
            } ${s.doneToday ? 'border-transparent' : 'border-line border-dashed hover:border-solid'}`}
            style={
              s.doneToday
                ? { backgroundColor: habit.color, color: 'var(--bg)' }
                : counted && s.amountToday > 0
                  ? {
                      // Partial days fill proportionally, so the button itself
                      // shows how far through the day you are.
                      backgroundColor: `${habit.color}${Math.round(
                        (s.amountToday / s.needPerDay) * 40 + 15,
                      )
                        .toString(16)
                        .padStart(2, '0')}`,
                      color: habit.color,
                    }
                  : { color: habit.color }
            }
          >
            {s.doneToday ? (
              <Check className="h-5 w-5" strokeWidth={3} />
            ) : counted ? (
              <span className="font-mono text-3xs font-semibold tabular-nums">
                {formatAmount(habit, s.amountToday)}
                <span className="opacity-60">/{formatAmount(habit, s.needPerDay)}</span>
              </span>
            ) : fromNotes ? (
              <PenLine className="h-5 w-5 opacity-50" />
            ) : habit.icon ? (
              <HabitIcon icon={habit.icon} className="h-5 w-5" />
            ) : (
              <Plus className="h-5 w-5 opacity-40" strokeWidth={2.5} />
            )}
          </button>
          {counted && s.amountToday > 0 && !archived && (
            <button
              type="button"
              onClick={() => onAdjust(habit.trackBy === 'duration' ? -5 : -1)}
              aria-label={`Remove one from ${habit.name}`}
              title="Remove one"
              className="motion-interactive cursor-pointer rounded p-0.5 text-faint transition-colors hover:text-danger"
            >
              <Minus className="h-3 w-3" />
            </button>
          )}
          {sliderPresence && (
            <AmountSlider
              habit={habit}
              initial={s.amountToday}
              notes={habit.logNotes[today] ?? []}
              onSetNotes={(n) => onSetNotes(today, n)}
              onCommit={(v) => onSetAmount(v)}
              onClose={() => setSliderOpen(false)}
              phase={sliderPresence.phase}
            />
          )}
        </div>

        {/* Title + meta. Clicking opens the read-only record. */}
        <button
          type="button"
          onClick={(event) => onOpenSummary(event.currentTarget)}
          aria-label={`Open ${habit.name} summary`}
          className="motion-interactive min-w-0 flex-1 cursor-pointer text-left"
        >
          <h3 className="flex items-center gap-1.5 truncate text-md font-semibold text-ink">
            {habit.icon && s.doneToday && (
              <span style={{ color: habit.color }}>
                <HabitIcon icon={habit.icon} className="h-4 w-4" />
              </span>
            )}
            <span className="truncate">{habit.name}</span>
          </h3>
          <p className="mt-0.5 truncate text-sm text-muted">
            <span className="text-faint">{repetitionLabel(habit)}</span>
            {counted && (
              <span className="text-faint">
                {' · '}
                <span style={{ color: habit.color }}>
                  {habit.trackBy === 'duration'
                    ? formatAmount(habit, s.needPerDay)
                    : `×${s.needPerDay}`}
                </span>
              </span>
            )}
            {fromNotes && <span className="text-faint"> · Auto from Notes</span>}
            {habit.description && <span className="text-faint"> · </span>}
            {habit.description}
            {archived && <span className="text-faint"> · Paused</span>}
          </p>
        </button>

        {/* Streak + total + menu */}
        <div className="flex shrink-0 items-center gap-2.5">
          <span
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1"
            style={{ backgroundColor: `${habit.color}1f` }}
            title={`Current streak${habit.targetStreak ? ` · target ${habit.targetStreak}` : ''}`}
          >
            <FlameIcon
              className="h-3.5 w-3.5"
              beaming={s.current > 0}
              color={habit.color}
              streak={s.current}
              peak={habit.targetStreak ?? 30}
            />
            <span className="font-mono text-sm font-semibold tabular-nums" style={{ color: habit.color }}>
              {s.current}
            </span>
            {s.unit === 'week' && <span className="text-3xs text-faint">wk</span>}
          </span>
          <span className="hidden items-baseline gap-1 sm:inline-flex">
            <span className="font-mono text-sm font-semibold tabular-nums text-ink">{s.total}</span>
            <span className="text-3xs text-faint">days</span>
          </span>
          <Dropdown
            label="Routine actions"
            trigger={({ toggle }) => (
              <button
                type="button"
                onClick={toggle}
                aria-label={`More actions for ${habit.name}`}
                className="motion-interactive -mr-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-faint transition-colors hover:bg-accent-soft hover:text-accent"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            )}
          >
            {(close) => (
              <>
                <MenuItem
                  icon={<Pencil className="h-4 w-4" />}
                  onClick={() => {
                    onEdit()
                    close()
                  }}
                >
                  Edit routine
                </MenuItem>
                <MenuItem
                  icon={
                    archived ? (
                      <ArchiveRestore className="h-4 w-4" />
                    ) : (
                      <Archive className="h-4 w-4" />
                    )
                  }
                  onClick={() => {
                    onArchive(!archived)
                    close()
                  }}
                >
                  {archived ? 'Resume routine' : 'Pause routine'}
                </MenuItem>
                <MenuItem
                  icon={<BookmarkPlus className="h-4 w-4" />}
                  onClick={() => {
                    onSaveTemplate()
                    close()
                  }}
                >
                  Save as template
                </MenuItem>
                <MenuDivider />
                <MenuItem
                  danger
                  icon={<Trash2 className="h-4 w-4" />}
                  onClick={() => {
                    onDelete()
                    close()
                  }}
                >
                  Delete
                </MenuItem>
              </>
            )}
          </Dropdown>
        </div>
      </div>

      {/* History */}
      <div className="routine-history-layout mt-4 min-w-0 max-w-full">
        <div className="routine-history-grid min-w-0">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div
              role="radiogroup"
              aria-label="History range"
              className="inline-flex rounded-md border border-line p-0.5"
            >
              {(
                [
                  ['month', 'This month'],
                  ['fourMonths', 'Last 4 months'],
                  ['twelveMonths', 'Last 12 months'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={range === value}
                  onClick={() => pickRange(value)}
                  className={`motion-interactive cursor-pointer rounded px-1.5 py-0.5 font-mono text-3xs transition-colors ${
                    range === value ? 'bg-accent-soft text-ink' : 'text-faint hover:text-ink'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <HeatmapLegend habit={habit} />
          </div>
          <div key={range} className="routine-history-range-content">
            <HabitMonthRows
              habit={habit}
              span={range}
              burstDate={burstDate}
              onPickDay={pickDay}
            />
          </div>
        </div>
        <div
          ref={detailRailRef}
          data-routine-detail-rail
          aria-hidden="true"
          className="routine-day-detail-rail"
        />
      </div>

      {/* Secondary stats */}
      <div className="mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-1 border-t border-line pt-3 font-mono text-3xs text-faint">
        <span>
          <span className="text-muted">{s.best}</span> best streak
        </span>
        {counted && (
          <span>
            <span className="text-muted">{formatAmount(habit, totalAmount(habit))}</span>{' '}
            {habit.trackBy === 'duration' ? 'total' : 'logs'}
          </span>
        )}
        <span>
          <span className="text-muted">{Math.round(s.rate * 100)}%</span> completion
        </span>
        <span>
          <span className="text-muted">
            {s.progress.done}/{s.progress.total}
          </span>{' '}
          {s.progress.label}
        </span>
        {habit.targetStreak !== null && (
          <span className={s.current >= habit.targetStreak ? 'text-success' : ''}>
            <span className={s.current >= habit.targetStreak ? '' : 'text-muted'}>
              {Math.min(s.current, habit.targetStreak)}/{habit.targetStreak}
            </span>{' '}
            to target
          </span>
        )}
      </div>
    </article>
  )
}
