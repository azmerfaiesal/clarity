# Recurring Tasks and Routines Design

## Goal

Let a user give a task a daily, selected-weekday, weekly, or monthly schedule. Completing one occurrence must preserve it in Completed and create the next active occurrence. Rename the user-facing Habits section to Routines without migrating or renaming the existing habit data model.

## Product decisions

- Recurrence is available to every signed-in Clarity user; there is no subscription gate in this release.
- A recurring task is a series of ordinary task occurrences, not one task whose completion history is overwritten.
- Completing the current occurrence leaves it completed and creates exactly one next occurrence.
- The repeat choices are Never, Daily, Selected days, Weekly, and Monthly.
- Selected days allows any non-empty combination of Monday through Sunday.
- Weekly uses the weekday of the current occurrence.
- Monthly uses the current occurrence's day of month. If that day does not exist, the occurrence falls on that month's final day. The original preferred day remains the anchor, so January 31 advances to February 28 or 29 and then March 31.
- A recurring task needs at least a due date or a reminder. The reminder instant is the preferred schedule anchor; otherwise the due date is used.
- When both are present, the next schedule is calculated from the reminder and the same calendar-day movement is applied to the due date. This preserves the relationship between the two fields.
- If an occurrence is completed late, Clarity skips missed slots and creates the first occurrence strictly after the completion time. It does not create a backlog.
- Reopening a completed occurrence does not remove or alter an already-created next occurrence.
- Editing the active occurrence changes the schedule copied into its future occurrences. Historical completed occurrences stay unchanged.
- Setting Repeat to Never ends the series after the active occurrence; it does not rewrite historical tasks.

## User experience

### Task composer and editor

A Repeat control appears beside the existing date, list, tags, reminder, and priority controls in both the add-task composer and Edit task dialog.

Choosing a repeat option expands a compact schedule panel using the existing expressive motion system. The panel scales and fades from the Repeat control, uses the established accent glow, and respects `prefers-reduced-motion` through the existing motion tokens.

- Daily shows a short summary: `Every day`.
- Selected days reveals seven Monday-through-Sunday toggle chips. At least one chip is required.
- Weekly shows the weekday derived from the reminder or due date.
- Monthly shows the preferred day of month.

If neither a reminder nor due date is set, recurrence choices remain unavailable and the control explains `Add a due date or reminder first`. Clearing both scheduling fields automatically changes Repeat to Never so an unschedulable series cannot be saved.

Task rows display a small repeat icon and a concise accessible label such as `Repeats Monday, Wednesday and Friday`. The editor and composer preserve keyboard operation, visible focus, 44-point-equivalent mobile targets, and screen-reader names.

### Completion

On the transition from incomplete to complete:

1. The current occurrence receives `completed = true` and `completedAt` as it does today.
2. If recurrence is enabled, Clarity calculates the first scheduled occurrence after the completion timestamp.
3. Clarity creates a new incomplete task with the same title, description, list, tags, priority, favorite state, and recurrence schedule.
4. The next occurrence receives advanced reminder and due-date values, a fresh creation timestamp and sort order, the same series identifier, and an incremented series sequence.
5. The existing completion animation and feedback remain unchanged.

The next occurrence ID is derived deterministically from the series identifier and next sequence number. If two devices complete the same occurrence before syncing, both produce the same row ID and Supabase upsert converges on one next task even if their clocks or local time zones differ.

### Routines rename

All visible navigation, headings, empty states, dialogs, guidance, tooltips, accessibility labels, and user documentation call the feature Routines. Examples include `Routines`, `My Routines`, `No routines yet`, and `Routine actions`.

Internal compatibility names remain unchanged: the `habits` view ID, TypeScript `Habit` types, local-storage keys, Supabase `clarity_habits` tables, realtime channel names, and existing synced data. This is a copy-only product rename, not a schema migration.

## Data model

Add these fields to `Task`:

```ts
type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6 // Sunday through Saturday

type TaskRecurrence =
  | { frequency: 'daily' }
  | { frequency: 'selectedDays'; weekdays: Weekday[] }
  | { frequency: 'weekly' }
  | { frequency: 'monthly'; preferredDay: number }

interface Task {
  // existing fields
  recurrence: TaskRecurrence | null
  recurrenceSeriesId: string | null
  recurrenceSequence: number | null
}
```

`weekdays` is normalized to unique ascending values and must contain at least one item. `preferredDay` is an integer from 1 through 31.

Supabase adds nullable `recurrence jsonb`, `recurrence_series_id text`, and `recurrence_sequence integer` columns to `public.clarity_tasks`, plus an index on `(user_id, recurrence_series_id)` for series lookup. The checked-in schema remains safe to rerun with `add column if not exists` statements for existing installations.

Old server rows and local-cache tasks omit the new fields. All read paths normalize missing or invalid recurrence data to `null`, so upgrading does not break existing accounts or offline data.

## Scheduling module

A focused task-recurrence utility owns validation, formatting, and date calculation. UI components and the store do not duplicate calendar rules.

The module exposes:

```ts
normalizeTaskRecurrence(value: unknown): TaskRecurrence | null
formatTaskRecurrence(recurrence: TaskRecurrence, anchor: Date): string
nextTaskOccurrence(task: Task, completedAt: Date): {
  anchor: Date
  reminder: string | null
  dueDate: string | null
} | null
recurringOccurrenceId(seriesId: string, sequence: number): string
```

Calendar calculations use local wall-clock dates so a 9:00 AM reminder remains 9:00 AM across daylight-saving changes. The next anchor is always strictly later than `completedAt`. Monthly calculations retain `preferredDay` independently of the clamped date.

## Store and sync behavior

The task reducer handles completion and next-occurrence creation in one state transition. The created occurrence is therefore written to local storage immediately with the completed occurrence and subsequently sent through the existing debounced Supabase upsert path.

New tasks start with no recurrence, series ID, or sequence. Enabling recurrence creates a series ID once and starts at sequence zero. Each generated occurrence increments the sequence. Duplicating a task creates an independent series ID at sequence zero when recurrence is retained, preventing the copy from colliding with the source series.

The Supabase row mappers read and write both new columns. Realtime merge behavior remains unchanged because the next occurrence is an ordinary task row with a deterministic ID.

## Notifications

Only the active task occurrence needs a pending notification. Once a task is completed, the existing task-state effect rebuilds the native notification plan and schedules the new occurrence's reminder.

The foreground web reminder sweep remains occurrence-based. iOS continues using the bounded 64-notification rolling plan and never schedules completed or deleted occurrences. No background server job or push-notification service is introduced.

## Error and edge-case behavior

- Invalid or legacy recurrence JSON is treated as Never rather than crashing the app.
- Empty Selected days cannot be saved.
- Completing a recurring task with an invalid or absent anchor completes the task but does not fabricate a next occurrence.
- Completing an overdue series skips missed occurrences.
- Monthly dates clamp to month end while retaining the preferred day for later months.
- Deleted, recycled, or already-completed tasks do not create occurrences.
- Network failure does not block completion; local state persists and sync retries through the existing offline-first flow.
- Reduced-motion users get immediate state changes with no scale or glow dependency.

## Verification

Automated coverage must include:

- recurrence normalization and human-readable summaries;
- daily, weekly, selected-weekday, and monthly next-date calculation;
- leap years, 29/30/31 month boundaries, local time preservation, and skipped overdue slots;
- deterministic occurrence IDs and duplicate-device convergence;
- completing, reopening, duplicating, deleting, and cancelling recurrence;
- composer and editor validation, keyboard behavior, motion-state attributes, and submitted data;
- Supabase row mapping for new, old, and malformed rows;
- browser and native notification planning for the new active occurrence;
- every visible section label changed from Habits to Routines while internal identifiers remain `habits`.

Final acceptance requires the focused tests, complete Vitest suite, lint, production build, Capacitor iOS sync, and an iPhone simulator or connected-device interaction pass in portrait and landscape.

## Out of scope

- Server push notifications while the web app is closed.
- Advanced intervals such as every two weeks or every three months.
- End dates, occurrence counts, and pause windows for task series.
- Editing all past occurrences or regenerating history.
- Renaming internal Habit types, storage keys, routes, or Supabase tables.
