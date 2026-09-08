# Recurring Tasks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add daily, selected-weekday, weekly, and monthly task recurrence that preserves completed occurrences and creates exactly one next active occurrence.

**Architecture:** Extend `Task` with a discriminated recurrence value, stable series ID, and sequence number. Put all validation, labels, calendar movement, and deterministic occurrence-ID logic in a pure utility; let the task reducer atomically complete the current row and append the next row. Reuse the existing local cache, Supabase upsert/realtime flow, and occurrence-based notification scheduler.

**Tech Stack:** React 19, TypeScript 6, Vitest, Testing Library, Tailwind CSS 4, Supabase Postgres, Capacitor Local Notifications.

**Spec:** `docs/superpowers/specs/2026-09-08-recurring-tasks-routines-design.md`

## Global Constraints

- Repeat choices are Never, Daily, Selected days, Weekly, and Monthly.
- Selected days permits any non-empty Monday-through-Sunday combination.
- Completing an occurrence preserves it in Completed and creates the first future occurrence, skipping missed slots.
- Monthly recurrence preserves the preferred day and clamps to month end when necessary.
- Reminder time remains local wall-clock time across calendar movement.
- A recurrence requires a reminder or due date; invalid legacy data normalizes to no recurrence.
- Multi-device completion must converge on one next task through a deterministic occurrence ID.
- Existing tasks, offline caches, notification limits, and Supabase rows remain backward compatible.
- All production behavior is implemented test-first.

---

### Task 1: Recurrence types, validation, and labels

**Files:**
- Modify: `src/types.ts`
- Create: `src/utils/taskRecurrence.ts`
- Create: `src/utils/taskRecurrence.test.ts`

**Interfaces:**
- Produces: `Weekday`, `TaskRecurrence`, `normalizeTaskRecurrence`, `formatTaskRecurrence`, and `taskRecurrenceAnchor`.
- Consumes: existing `Task` date and reminder fields.

- [ ] **Step 1: Write failing normalization and label tests**

Create `src/utils/taskRecurrence.test.ts` with focused tests:

```ts
import { describe, expect, it } from 'vitest'
import {
  formatTaskRecurrence,
  normalizeTaskRecurrence,
  taskRecurrenceAnchor,
} from './taskRecurrence'
import type { Task } from '../types'

describe('normalizeTaskRecurrence', () => {
  it('normalizes selected weekdays to unique ascending values', () => {
    expect(normalizeTaskRecurrence({ frequency: 'selectedDays', weekdays: [5, 1, 5, 0] }))
      .toEqual({ frequency: 'selectedDays', weekdays: [0, 1, 5] })
  })

  it.each([
    null,
    {},
    { frequency: 'selectedDays', weekdays: [] },
    { frequency: 'selectedDays', weekdays: [7] },
    { frequency: 'monthly', preferredDay: 0 },
    { frequency: 'monthly', preferredDay: 32 },
  ])('turns invalid input into no recurrence', (value) => {
    expect(normalizeTaskRecurrence(value)).toBeNull()
  })
})

describe('formatTaskRecurrence', () => {
  it('formats a Monday, Wednesday, Friday schedule in weekday order', () => {
    expect(
      formatTaskRecurrence(
        { frequency: 'selectedDays', weekdays: [1, 3, 5] },
        new Date(2026, 8, 8, 9),
      ),
    ).toBe('Every Monday, Wednesday and Friday')
  })
})

describe('taskRecurrenceAnchor', () => {
  it('prefers the reminder over the due date', () => {
    const task = {
      reminder: new Date(2026, 8, 10, 9, 30).toISOString(),
      dueDate: '2026-09-08',
    } as Task
    expect(taskRecurrenceAnchor(task)?.getDate()).toBe(10)
  })
})
```

- [ ] **Step 2: Run the test and verify the RED state**

Run:

```bash
npm test -- src/utils/taskRecurrence.test.ts
```

Expected: FAIL because `taskRecurrence.ts` and the recurrence types do not exist.

- [ ] **Step 3: Add the recurrence types to `src/types.ts`**

Add:

```ts
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type TaskRecurrence =
  | { frequency: 'daily' }
  | { frequency: 'selectedDays'; weekdays: Weekday[] }
  | { frequency: 'weekly' }
  | { frequency: 'monthly'; preferredDay: number }
```

Add required `recurrence: TaskRecurrence | null`, `recurrenceSeriesId: string | null`, and `recurrenceSequence: number | null` fields to `Task`.

- [ ] **Step 4: Implement the minimal pure validation and formatting module**

Create `src/utils/taskRecurrence.ts`. Validate unknown objects without unsafe assertions, normalize weekday arrays, derive the anchor from a valid reminder or local due date, and return these exact labels:

```text
Never
Every day
Every Monday, Wednesday and Friday
Every Tuesday
Monthly on day 31
```

Use `Intl.DateTimeFormat(undefined, { weekday: 'long' })` to obtain localized weekday names and join multiple names with `Intl.ListFormat`.

- [ ] **Step 5: Run the focused test and full type-aware suite**

Run:

```bash
npm test -- src/utils/taskRecurrence.test.ts
npm run build
```

Expected: the focused tests pass; the build initially identifies every existing Task fixture that needs the two backward-compatible fields. Update production seed constructors in this task to initialize both fields to `null`; leave test fixtures to the task that owns each test.

- [ ] **Step 6: Commit the type and validation unit**

```bash
git add src/types.ts src/utils/taskRecurrence.ts src/utils/taskRecurrence.test.ts
git commit -m "feat: define task recurrence schedules"
```

---

### Task 2: Calendar advancement and deterministic occurrence identity

**Files:**
- Modify: `src/utils/taskRecurrence.ts`
- Modify: `src/utils/taskRecurrence.test.ts`

**Interfaces:**
- Consumes: `TaskRecurrence`, `taskRecurrenceAnchor` from Task 1.
- Produces: `nextTaskOccurrence(task, completedAt)` and `recurringOccurrenceId(seriesId, sequence)`.

- [ ] **Step 1: Write failing calendar tests**

Add tests covering these exact cases:

```ts
it('moves a daily reminder to the first slot after late completion', () => {
  const task = recurringTask({
    reminder: new Date(2026, 8, 5, 9, 30).toISOString(),
    dueDate: '2026-09-05',
    recurrence: { frequency: 'daily' },
  })
  const next = nextTaskOccurrence(task, new Date(2026, 8, 8, 10))!
  expect(localParts(new Date(next.reminder!))).toEqual([2026, 9, 9, 9, 30])
  expect(next.dueDate).toBe('2026-09-09')
})

it('finds the next selected weekday', () => {
  const task = recurringTask({
    reminder: new Date(2026, 8, 7, 8).toISOString(),
    recurrence: { frequency: 'selectedDays', weekdays: [1, 3, 5] },
  })
  const next = nextTaskOccurrence(task, new Date(2026, 8, 7, 12))!
  expect(localParts(new Date(next.reminder!))).toEqual([2026, 9, 9, 8, 0])
})

it('restores the preferred monthly day after a short month', () => {
  const feb = nextTaskOccurrence(
    recurringTask({
      reminder: new Date(2027, 0, 31, 9).toISOString(),
      recurrence: { frequency: 'monthly', preferredDay: 31 },
    }),
    new Date(2027, 0, 31, 12),
  )!
  expect(localParts(new Date(feb.reminder!)).slice(0, 3)).toEqual([2027, 2, 28])

  const mar = nextTaskOccurrence(
    recurringTask({
      reminder: feb.reminder,
      recurrence: { frequency: 'monthly', preferredDay: 31 },
    }),
    new Date(2027, 1, 28, 12),
  )!
  expect(localParts(new Date(mar.reminder!)).slice(0, 3)).toEqual([2027, 3, 31])
})

it('creates the same occurrence id for the same series and anchor', () => {
  expect(recurringOccurrenceId('series-a', 4)).toBe(
    recurringOccurrenceId('series-a', 4),
  )
})
```

The helper `recurringTask` must construct a complete `Task` and `localParts` must inspect local calendar fields, not parse formatted strings.

- [ ] **Step 2: Run the tests and verify calendar-specific failures**

```bash
npm test -- src/utils/taskRecurrence.test.ts
```

Expected: FAIL because the advancement and ID functions are absent.

- [ ] **Step 3: Implement local calendar advancement**

Implement recurrence as calendar operations, never as fixed millisecond addition:

```ts
export type NextTaskOccurrence = {
  anchor: Date
  reminder: string | null
  dueDate: string | null
}
```

- Daily: add calendar days until the anchor is strictly after completion.
- Selected days: scan forward by local date until a selected weekday is strictly after completion.
- Weekly: add calendar weeks until strictly after completion.
- Monthly: increment year/month from the current anchor, choose `min(preferredDay, daysInMonth)`, and retain the original local hour/minute.
- Apply the chosen calendar-day delta to an existing due date.
- Return `null` for missing or invalid anchors.

Implement the stable text ID without asynchronous hashing:

```ts
export function recurringOccurrenceId(seriesId: string, sequence: number): string {
  return `rec:${seriesId}:${sequence}`
}
```

- [ ] **Step 4: Add boundary coverage**

Add tests for leap-year February 29, Sunday/Saturday selected days, due-date-only recurrence, invalid reminder with valid due date fallback, and DST-adjacent local hour preservation where the test runtime supports it.

- [ ] **Step 5: Run focused tests**

```bash
npm test -- src/utils/taskRecurrence.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit calendar behavior**

```bash
git add src/utils/taskRecurrence.ts src/utils/taskRecurrence.test.ts
git commit -m "feat: calculate recurring task occurrences"
```

---

### Task 3: Atomic completion and offline task-store behavior

**Files:**
- Modify: `src/store/taskStore.tsx`
- Create: `src/store/taskStore.recurrence.test.tsx`
- Modify: `src/store/storage.ts`
- Modify: task fixtures found by `npm run build`

**Interfaces:**
- Consumes: `nextTaskOccurrence`, `recurringOccurrenceId`, `normalizeTaskRecurrence`.
- Produces: atomic completion that appends one next occurrence and safe recurrence handling in add, update, and duplicate operations.

- [ ] **Step 1: Export a reducer test seam and write failing store tests**

Rename the private reducer to exported `taskReducer` without changing behavior, and export a `TaskState` type only if required by the test. Create tests that dispatch real reducer actions and assert state:

```ts
it('completes the current task and appends one next occurrence', () => {
  const state = stateWith(recurringTask({ id: 'current', recurrenceSeriesId: 'series-a' }))
  const next = taskReducer(state, {
    type: 'TOGGLE_COMPLETE',
    id: 'current',
    recurrenceSequence: 0,
    now: '2026-09-08T04:00:00.000Z',
  })
  expect(next.tasks.find((task) => task.id === 'current')?.completed).toBe(true)
  expect(next.tasks.filter((task) => !task.completed)).toHaveLength(1)
  expect(next.tasks[1].recurrenceSeriesId).toBe('series-a')
  expect(next.tasks[1].recurrenceSequence).toBe(1)
})

it('does not create another occurrence when reopening history', () => {
  const state = stateWith(recurringTask({ completed: true, completedAt: '2026-09-08T04:00:00.000Z' }))
  const next = taskReducer(state, {
    type: 'TOGGLE_COMPLETE',
    id: 'current',
    now: '2026-09-08T05:00:00.000Z',
  })
  expect(next.tasks).toHaveLength(1)
  expect(next.tasks[0].completed).toBe(false)
})

it('converges on one deterministic next occurrence', () => {
  const first = taskReducer(stateWith(source), completionAction)
  const second = taskReducer(stateWith(source), completionAction)
  expect(first.tasks[1].id).toBe(second.tasks[1].id)
})
```

Add `now?: string` to the internal toggle action so tests do not depend on the wall clock; production dispatch omits it.

- [ ] **Step 2: Run the reducer tests and verify RED**

```bash
npm test -- src/store/taskStore.recurrence.test.tsx
```

Expected: FAIL because completion does not append a next occurrence.

- [ ] **Step 3: Implement atomic completion**

For incomplete-to-complete only:

```ts
const completedTask = { ...task, completed: true, completedAt: now, updatedAt: now }
const next = buildNextRecurringTask(completedTask, new Date(now))
return next ? [...otherTasks, completedTask, next] : [...otherTasks, completedTask]
```

`buildNextRecurringTask` must copy user-owned fields, set `completed`, `completedAt`, and `deletedAt` to their active defaults, use a fresh `createdAt`/`updatedAt`/`sortOrder`, preserve recurrence and series ID, increment the sequence, and use the deterministic occurrence ID.

Before appending, check `state.tasks.some(({ id }) => id === next.id)` so replaying the action cannot duplicate the row locally.

- [ ] **Step 4: Test add, update, cancel, and duplicate semantics**

Add failing tests, then implement:

- `addTask` accepts `recurrence`; if valid, it assigns a new `recurrenceSeriesId` and sequence zero.
- `updateTask` normalizes recurrence, assigns a series ID and sequence zero only when enabling it, and clears both when setting recurrence to `null`.
- clearing both reminder and due date clears recurrence, series ID, and sequence.
- duplicate retains the schedule but receives a different series ID at sequence zero.
- a malformed recurrence completes without creating a next row.
- deleted or recycled tasks never create a next row.

Do not generate a series ID in UI components.

- [ ] **Step 5: Normalize old local-cache tasks**

Change `loadTasks` to map parsed task objects through a narrow migration that adds:

```ts
recurrence: normalizeTaskRecurrence(task.recurrence),
recurrenceSeriesId:
  normalizeTaskRecurrence(task.recurrence) && typeof task.recurrenceSeriesId === 'string'
    ? task.recurrenceSeriesId
    : null,
recurrenceSequence:
  normalizeTaskRecurrence(task.recurrence) && Number.isInteger(task.recurrenceSequence)
    ? task.recurrenceSequence
    : null,
```

Add a storage test proving a pre-upgrade task loads with both fields set to `null`.

- [ ] **Step 6: Run focused and dependent tests**

```bash
npm test -- src/store/taskStore.recurrence.test.tsx src/utils/taskUtils.test.ts src/store/notifications.test.ts
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit store behavior**

```bash
git add src/store/taskStore.tsx src/store/taskStore.recurrence.test.tsx src/store/storage.ts src/types.ts
git add $(git diff --name-only -- 'src/**/*.test.ts' 'src/**/*.test.tsx')
git commit -m "feat: advance recurring tasks on completion"
```

Before committing, inspect `git diff --cached --name-only` and unstage unrelated files; the second `git add` is only for Task fixture updates reported by the build.

---

### Task 4: Supabase persistence and migration

**Files:**
- Modify: `src/store/sync.ts`
- Create: `src/store/sync.recurrence.test.ts`
- Modify: `supabase/schema.sql`

**Interfaces:**
- Consumes: `normalizeTaskRecurrence`, `Task.recurrence`, and `Task.recurrenceSeriesId`.
- Produces: backward-compatible row mapping and idempotent database columns.

- [ ] **Step 1: Export task row-mapping test seams and write failing tests**

Export the mapping functions as `rowToTask` and `taskToRow` and test:

```ts
it('loads a pre-recurrence server row safely', () => {
  expect(rowToTask(serverTask({ recurrence: undefined, recurrence_series_id: undefined })))
    .toMatchObject({ recurrence: null, recurrenceSeriesId: null })
})

it('round trips a selected-day recurrence', () => {
  const task = localTask({
    recurrence: { frequency: 'selectedDays', weekdays: [1, 3, 5] },
    recurrenceSeriesId: 'series-a',
    recurrenceSequence: 3,
  })
  expect(rowToTask(taskToRow(task, 'user-a'))).toMatchObject({
    recurrence: { frequency: 'selectedDays', weekdays: [1, 3, 5] },
    recurrenceSeriesId: 'series-a',
    recurrenceSequence: 3,
  })
})

it('drops malformed recurrence JSON from the server', () => {
  expect(rowToTask(serverTask({ recurrence: { frequency: 'monthly', preferredDay: 45 } })).recurrence)
    .toBeNull()
})
```

- [ ] **Step 2: Run the mapping tests and verify RED**

```bash
npm test -- src/store/sync.recurrence.test.ts
```

Expected: FAIL because the mappers do not handle recurrence.

- [ ] **Step 3: Map the new columns**

Read with `normalizeTaskRecurrence(r.recurrence)` and only retain a string `recurrence_series_id` plus a non-negative integer `recurrence_sequence` when recurrence is valid. Write all three recurrence columns from the normalized Task.

- [ ] **Step 4: Add the idempotent schema migration**

After the tasks table definition, add:

```sql
alter table public.clarity_tasks
  add column if not exists recurrence jsonb,
  add column if not exists recurrence_series_id text,
  add column if not exists recurrence_sequence integer;

create index if not exists clarity_tasks_series_idx
  on public.clarity_tasks (user_id, recurrence_series_id)
  where recurrence_series_id is not null;
```

Also include the two columns in the `create table if not exists` block so new projects get the complete schema in one statement.

- [ ] **Step 5: Verify mapping and schema syntax locally**

```bash
npm test -- src/store/sync.recurrence.test.ts
npm run build
git diff --check -- supabase/schema.sql src/store/sync.ts src/store/sync.recurrence.test.ts
```

Expected: PASS and no whitespace errors. Do not apply the schema to the user's hosted Supabase project without a separate deployment step and explicit confirmation of the target project.

- [ ] **Step 6: Commit persistence support**

```bash
git add src/store/sync.ts src/store/sync.recurrence.test.ts supabase/schema.sql
git commit -m "feat: sync recurring task schedules"
```

---

### Task 5: Shared recurrence control and premium motion

**Files:**
- Create: `src/components/TaskRecurrenceField.tsx`
- Create: `src/components/TaskRecurrenceField.test.tsx`
- Modify: `src/components/TaskComposerFields.tsx`
- Modify: `src/components/TaskComposerFields.test.tsx`
- Modify: `src/components/TaskEditor.tsx`
- Create: `src/components/TaskEditor.recurrence.test.tsx`
- Modify: `src/index.css`
- Modify: `src/index.motion.test.ts`

**Interfaces:**
- Consumes: `TaskRecurrence`, `Weekday`, `taskRecurrenceAnchor`, and `formatTaskRecurrence`.
- Produces: `TaskRecurrenceField` and recurrence values submitted by both task forms.

- [ ] **Step 1: Write failing shared-control interaction tests**

Render `TaskRecurrenceField` with a valid anchor and assert:

```ts
fireEvent.click(screen.getByRole('button', { name: /repeat/i }))
fireEvent.click(screen.getByRole('radio', { name: 'Selected days' }))
fireEvent.click(screen.getByRole('checkbox', { name: 'Monday' }))
fireEvent.click(screen.getByRole('checkbox', { name: 'Wednesday' }))
expect(onChange).toHaveBeenLastCalledWith({ frequency: 'selectedDays', weekdays: [1, 3] })
expect(screen.getByTestId('task-repeat-panel')).toHaveClass('motion-repeat-panel')
```

Add separate tests that recurrence choices are disabled without an anchor, empty selected days show a validation message, weekly derives its weekday, and monthly initializes its preferred day from the anchor.

- [ ] **Step 2: Run the component test and verify RED**

```bash
npm test -- src/components/TaskRecurrenceField.test.tsx
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement `TaskRecurrenceField`**

Use a labeled button to expand an anchored panel. Use semantic radio controls for frequencies and checkbox controls for weekdays. Render weekday chips visually Monday through Sunday while retaining numeric values `1,2,3,4,5,6,0`.

Required prop contract:

```ts
type TaskRecurrenceFieldProps = {
  value: TaskRecurrence | null
  anchor: Date | null
  onChange: (value: TaskRecurrence | null) => void
}
```

Every tappable frequency and weekday control must have at least `min-h-11` on compact layouts, a visible focus state, and an accessible name. The expanded panel must stay within the task dialog's width in portrait and landscape.

The control owns only disclosure state. The parent owns recurrence value. Close it on Escape and outside click using the same fixed-popover reflow helpers already used elsewhere if the panel is positioned outside normal flow.

- [ ] **Step 4: Add motion styling test-first**

First add an assertion to `src/index.motion.test.ts` that the stylesheet contains `.motion-repeat-panel` and a reduced-motion override. Verify failure, then add CSS using the existing motion duration/easing variables, accent shadow, opacity, and scale. Avoid a new hard-coded animation system.

- [ ] **Step 5: Integrate with the add-task composer**

Extend `TaskDraftInput` with `recurrence: TaskRecurrence | null`. Store recurrence state, pass `fromDateTimeLocal(reminder)` or local due date as the anchor, and automatically clear recurrence when both inputs are cleared.

Add a test that submits a Monday/Wednesday schedule and asserts `onSubmit` receives it. Add a test that clearing the final anchor resets recurrence to `null`.

- [ ] **Step 6: Integrate with the task editor**

Initialize from `task.recurrence`, render the shared field, and include `recurrence` in `onSave`. Do not generate or mutate the series ID in the editor.

Add a test that an existing monthly recurrence renders `Monthly on day 31`, changes to selected days, and saves the selected weekday array.

- [ ] **Step 7: Run focused UI tests**

```bash
npm test -- src/components/TaskRecurrenceField.test.tsx src/components/TaskComposerFields.test.tsx src/components/TaskEditor.recurrence.test.tsx src/index.motion.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit recurrence UI**

```bash
git add src/components/TaskRecurrenceField.tsx src/components/TaskRecurrenceField.test.tsx src/components/TaskComposerFields.tsx src/components/TaskComposerFields.test.tsx src/components/TaskEditor.tsx src/components/TaskEditor.recurrence.test.tsx src/index.css src/index.motion.test.ts
git commit -m "feat: add recurring task controls"
```

---

### Task 6: Task-row recurrence summary and notification regression coverage

**Files:**
- Modify: `src/components/TaskItem.tsx`
- Create: `src/components/TaskItem.recurrence.test.tsx`
- Modify: `src/store/notifications.test.ts`

**Interfaces:**
- Consumes: `formatTaskRecurrence` and existing occurrence-based reminder plan.
- Produces: visible and accessible recurrence metadata in task rows; regression proof that only active occurrences are scheduled.

- [ ] **Step 1: Write the failing row-summary test**

Render a recurring task and assert a repeat icon has an accessible label:

```ts
expect(screen.getByLabelText('Repeats every Monday, Wednesday and Friday')).toBeVisible()
```

The metadata container must render when recurrence is the only task metadata.

- [ ] **Step 2: Run and verify RED**

```bash
npm test -- src/components/TaskItem.recurrence.test.tsx
```

Expected: FAIL because TaskItem does not render recurrence.

- [ ] **Step 3: Add the recurrence summary**

Import Lucide `Repeat2`, derive the anchor and summary through the utility, include recurrence in the metadata-row condition, and render a compact faint icon plus screen-reader label. Do not duplicate label formatting.

- [ ] **Step 4: Add notification regression coverage**

Extend the Task fixture with recurrence fields. Add a test with one completed occurrence and its next active occurrence, asserting the native plan contains only the next occurrence's reminder and retains the 60-item internal cap.

No production notification change should be required because each occurrence already has one exact reminder. If the test exposes a bug, write a narrower failing case before changing production code.

- [ ] **Step 5: Run focused tests and commit**

```bash
npm test -- src/components/TaskItem.recurrence.test.tsx src/store/notifications.test.ts
git add src/components/TaskItem.tsx src/components/TaskItem.recurrence.test.tsx src/store/notifications.test.ts
git commit -m "feat: show recurring task schedules"
```

---

### Task 7: Documentation, full verification, and iOS acceptance

**Files:**
- Modify: `README.md`
- Modify: `src/components/Guide.tsx`
- Modify: any recurrence-related test fixture still identified by TypeScript

**Interfaces:**
- Consumes: all recurrence behavior from Tasks 1-6.
- Produces: accurate user guidance and release evidence.

- [ ] **Step 1: Update user documentation**

Document the five Repeat choices, the completion-to-next-occurrence behavior, selected weekdays, month-end clamping, offline sync, and the limitation that browser reminders require Clarity to be open while iOS local reminders can fire when the app is closed.

- [ ] **Step 2: Run all automated verification**

```bash
npm test
npm run lint
npm run build
git diff --check
```

Expected: all tests pass; lint has no errors; production build succeeds; no whitespace errors. Existing documented lint warnings may be reported separately but no new warning is acceptable.

- [ ] **Step 3: Synchronize the iOS project**

```bash
npx cap sync ios
plutil -lint ios/App/App/Info.plist
```

Expected: Capacitor sync succeeds and the property list is valid.

- [ ] **Step 4: Run interactive acceptance**

On a simulator or the connected iPhone:

1. Create Daily, Selected days, Weekly, and Monthly tasks.
2. Confirm the repeat panel opens and closes smoothly in portrait and landscape.
3. Confirm weekday chips remain fully visible around the safe area and notch.
4. Complete each task and verify the completed occurrence stays in Completed while exactly one next active occurrence appears.
5. Complete an overdue task and verify missed slots are skipped.
6. Verify January 31 monthly behavior through a controlled test date or unit-test evidence.
7. Verify the next active reminder is scheduled and the completed reminder disappears.
8. Turn Reduce Motion on and confirm all controls remain usable without animated dependency.

- [ ] **Step 5: Commit documentation and fixture cleanup**

```bash
git add README.md src/components/Guide.tsx
git add $(git diff --name-only -- 'src/**/*.test.ts' 'src/**/*.test.tsx')
git commit -m "docs: explain recurring task behavior"
```

Inspect the staged paths and exclude unrelated files before committing.

- [ ] **Step 6: Record final evidence**

Capture the exact test count, lint result, build result, Capacitor sync result, and device/simulator used. Do not claim a physical-device pass if only simulator testing was possible.
