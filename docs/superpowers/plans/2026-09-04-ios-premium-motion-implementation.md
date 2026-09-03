# Clarity iOS Premium Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Clarity's iOS interface expressive, consistent motion; replace mobile inline task entry with a modal that grows from the floating add button; add the year to Home; and keep every landscape control clear of the iPhone notch.

**Architecture:** Reuse Clarity's React and Capacitor stack. Add a small motion/presence foundation, refactor the existing quick-add fields into a shared form, and wrap them with separate desktop-inline and mobile-modal presentations. CSS variables and compositor-friendly transforms provide the visual language, while the existing Capacitor bridge provides best-effort haptics and four-sided safe-area handling.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest 4, Tailwind CSS 4, Capacitor 8, Capacitor Haptics, Xcode/iOS Simulator

**Spec:** `docs/superpowers/specs/2026-09-03-ios-premium-motion-design.md`

## Global Constraints

- The motion direction is expressive: larger scaling, stronger accent glows, and prominent transitions in the 360-460 ms range.
- Frequent motion must use opacity, `transform`, or the independent `scale` property where possible; it must not cause scroll jumps.
- Reduce Motion removes large travel, overshoot, pulsing, and scaling while preserving short fades and identical behavior.
- Animation and haptic failures must never prevent a task, habit, note, navigation, or synchronization action.
- The existing task, habit, note, authentication, Supabase, and notification data models remain unchanged.
- The Habits history grid remains unchanged.
- No macOS work is included.
- Preserve all unrelated existing working-tree changes; stage only the files named by the current task.

## File Structure

### New files

- `src/utils/motion.ts` — shared motion durations, phases, and pure presence-state transitions.
- `src/utils/motion.test.ts` — reducer and duration tests for deterministic open/close behavior.
- `src/components/MotionPresence.tsx` — React hook/component that preserves content through exit animation and provides `data-motion-state`.
- `src/components/MotionPresence.test.tsx` — mount, exit-delay, rapid-reopen, and exit-callback tests.
- `src/components/TaskComposerFields.tsx` — the single stateful task-draft form used by both presentations.
- `src/components/TaskComposerModal.tsx` — safe-area-aware mobile dialog, backdrop, focus, and button-origin animation.
- `src/components/TaskComposerModal.test.tsx` — modal submission, dismissal, defaults, and focus-restoration tests.
- `src/test/setup.ts` — React Testing Library cleanup and React act environment.
- `src/index.motion.test.ts` — static contract checks for motion tokens, reduced-motion rules, and four-sided native safe areas.

### Modified files

- `package.json`, `package-lock.json`, `vite.config.ts` — add jsdom/React component-test support.
- `src/utils/dateUtils.ts`, `src/utils/dateUtils.test.ts` — own and test the localized Home-date formatter.
- `src/components/Home.tsx` — render the formatter that includes the year.
- `src/components/TaskInput.tsx` — keep only desktop inline disclosure behavior and reuse `TaskComposerFields`.
- `src/App.tsx` — choose native/mobile modal versus desktop inline presentation, retain view defaults, restore focus, animate page changes, and place the floating button.
- `src/native/platform.ts` — centralize selection/success/warning haptic intents.
- `src/index.css` — motion tokens, touch feedback, entrance/exit states, stronger glows, and native safe-area rules.
- `src/components/Dropdown.tsx` — preserve menus for their exit and set a trigger-relative transform origin.
- `src/components/TaskEditor.tsx`, `src/components/Settings.tsx`, `src/components/HabitForm.tsx`, `src/components/HabitSummary.tsx`, `src/components/NoteTemplates.tsx` — consume shared overlay motion states rather than entrance-only classes.
- `src/components/HabitTracker.tsx`, `src/components/BrainDump.tsx` — preserve value-backed dialogs through exit and add meaningful completion feedback.
- `src/components/Sidebar.tsx`, `src/components/Header.tsx`, `src/components/TaskItem.tsx`, `src/components/TaskCheckbox.tsx`, `src/components/GlobalSearch.tsx`, `src/components/UndoToast.tsx` — apply shared interactive/page/content motion classes and targeted haptics.
- `src/components/Guide.tsx`, `README.md` — describe the mobile modal task flow and iOS safe-area behavior.

---

### Task 1: Localized Home Date with Year

**Files:**
- Modify: `src/utils/dateUtils.ts:1-18`
- Create: `src/utils/dateUtils.test.ts`
- Modify: `src/components/Home.tsx:1-99`

**Interfaces:**
- Consumes: JavaScript `Date` and `Intl.LocalesArgument`.
- Produces: `formatHomeDate(date: Date, locales?: Intl.LocalesArgument): string`.

- [ ] **Step 1: Write the failing formatter test**

```ts
import { describe, expect, it } from 'vitest'
import { formatHomeDate } from './dateUtils'

describe('formatHomeDate', () => {
  it('includes weekday, day, month, and four-digit year', () => {
    const date = new Date(2026, 8, 3, 12)

    expect(formatHomeDate(date, 'en-GB')).toBe('Thursday 3 September 2026')
  })
})
```

- [ ] **Step 2: Run the test and confirm the missing export is the failure**

Run: `npm test -- src/utils/dateUtils.test.ts`

Expected: FAIL because `formatHomeDate` is not exported.

- [ ] **Step 3: Implement the formatter and use it on Home**

```ts
export function formatHomeDate(
  date: Date,
  locales?: Intl.LocalesArgument,
): string {
  return date.toLocaleDateString(locales, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
```

Import `formatHomeDate` in `Home.tsx` and replace the inline three-field
`toLocaleDateString` call with `formatHomeDate(new Date())`. Keep the existing
uppercase CSS treatment so casing remains a visual concern.

- [ ] **Step 4: Run the focused and existing utility tests**

Run: `npm test -- src/utils/dateUtils.test.ts src/utils/taskUtils.test.ts src/utils/habitUtils.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit only the date change**

```bash
git add src/utils/dateUtils.ts src/utils/dateUtils.test.ts src/components/Home.tsx
git commit -m "feat: show the year on the Home date"
```

---

### Task 2: Motion Tokens, Presence Lifecycle, and UI Test Harness

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `vite.config.ts:1-9`
- Create: `src/test/setup.ts`
- Create: `src/utils/motion.ts`
- Create: `src/utils/motion.test.ts`
- Create: `src/components/MotionPresence.tsx`
- Create: `src/components/MotionPresence.test.tsx`
- Modify: `src/index.css:45-155,348-687`
- Create: `src/index.motion.test.ts`

**Interfaces:**
- Produces: `MotionPhase = 'entering' | 'entered' | 'exiting'`.
- Produces: `MOTION_MS = { press: 160, standard: 320, prominent: 420, exit: 280 } as const`.
- Produces: `presenceTransition(state: PresenceState, event: PresenceEvent): PresenceState`.
- Produces: `usePresenceValue<T>(value: T | null, options?: { exitMs?: number; onExited?: () => void }): { value: T; phase: MotionPhase } | null`.
- Produces CSS contracts: `--motion-press`, `--motion-standard`, `--motion-prominent`, `--motion-exit`, `--ease-spring`, `--ease-exit`, `.motion-interactive`, `.motion-primary`, `.motion-overlay`, `.motion-dialog`, and `[data-motion-state]` variants.

- [ ] **Step 1: Install component-test dependencies**

Run:

```bash
npm install --save-dev @testing-library/react @testing-library/user-event jsdom
```

Expected: `package.json` and `package-lock.json` add only development dependencies.

- [ ] **Step 2: Configure Vitest's DOM environment**

Change `vite.config.ts` to import `defineConfig` from `vitest/config` and add:

```ts
test: {
  environment: 'jsdom',
  setupFiles: ['./src/test/setup.ts'],
},
```

Create `src/test/setup.ts`:

```ts
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
afterEach(cleanup)
```

- [ ] **Step 3: Write failing pure lifecycle tests**

```ts
import { describe, expect, it } from 'vitest'
import { MOTION_MS, presenceTransition } from './motion'

describe('motion presence', () => {
  it('enters, exits, and can reverse an interrupted exit', () => {
    const entering = presenceTransition({ mounted: false, phase: null }, { type: 'show' })
    const entered = presenceTransition(entering, { type: 'entered' })
    const exiting = presenceTransition(entered, { type: 'hide' })

    expect(entering).toEqual({ mounted: true, phase: 'entering' })
    expect(exiting).toEqual({ mounted: true, phase: 'exiting' })
    expect(presenceTransition(exiting, { type: 'show' })).toEqual({
      mounted: true,
      phase: 'entering',
    })
    expect(MOTION_MS.prominent).toBe(420)
  })
})
```

- [ ] **Step 4: Run the lifecycle test and confirm it fails for missing code**

Run: `npm test -- src/utils/motion.test.ts`

Expected: FAIL because `motion.ts` does not exist.

- [ ] **Step 5: Implement the pure motion state API**

```ts
export const MOTION_MS = {
  press: 160,
  standard: 320,
  prominent: 420,
  exit: 280,
} as const

export type MotionPhase = 'entering' | 'entered' | 'exiting'
export type PresenceState = { mounted: boolean; phase: MotionPhase | null }
export type PresenceEvent = { type: 'show' | 'entered' | 'hide' | 'exited' }

export function presenceTransition(state: PresenceState, event: PresenceEvent): PresenceState {
  if (event.type === 'show') return { mounted: true, phase: 'entering' }
  if (event.type === 'entered' && state.mounted) return { mounted: true, phase: 'entered' }
  if (event.type === 'hide' && state.mounted) return { mounted: true, phase: 'exiting' }
  if (event.type === 'exited') return { mounted: false, phase: null }
  return state
}
```

- [ ] **Step 6: Write failing component-presence tests**

Use fake timers and `rerender` to assert that a non-null value remains visible
for `MOTION_MS.exit` after its prop becomes `null`, `onExited` fires once, and
restoring the value during exit cancels unmounting.

```tsx
function Probe({ value, onExited }: { value: string | null; onExited: () => void }) {
  const presence = usePresenceValue(value, { onExited })
  return presence ? <div data-state={presence.phase}>{presence.value}</div> : null
}
```

- [ ] **Step 7: Run the presence component test and confirm it fails**

Run: `npm test -- src/components/MotionPresence.test.tsx`

Expected: FAIL because `usePresenceValue` does not exist.

- [ ] **Step 8: Implement `usePresenceValue`**

Use the reducer from `motion.ts`, one `requestAnimationFrame` to move from
`entering` to `entered`, and a cleared/replaced timeout for `exiting` to
`exited`. Keep the last non-null value in state until exit completes. Invoke
`onExited` only after unmount state is committed. Clear RAF and timeout handles
on effect cleanup.

- [ ] **Step 9: Write failing CSS contract tests**

Read `src/index.css` with `readFileSync` and assert that all motion variables,
all three `data-motion-state` selectors, and the existing
`prefers-reduced-motion: reduce` block are present.

```ts
expect(css).toContain('--motion-prominent: 420ms')
expect(css).toContain("[data-motion-state='exiting']")
expect(css).toContain('@media (prefers-reduced-motion: reduce)')
```

- [ ] **Step 10: Add the shared CSS motion foundation**

Define tokens on `:root`, expressive modal/backdrop entrance and exit states,
independent touch `scale`, stronger primary glow, and reusable content/page
entrances. Use unlayered selectors only where they must override Tailwind.
Avoid assigning `transform` globally because the drawer, FAB, and translated
toasts already own transforms.

- [ ] **Step 11: Run motion tests and the full suite**

Run: `npm test`

Expected: all tests PASS without React act warnings.

- [ ] **Step 12: Commit the shared foundation**

```bash
git add package.json package-lock.json vite.config.ts src/test/setup.ts src/utils/motion.ts src/utils/motion.test.ts src/components/MotionPresence.tsx src/components/MotionPresence.test.tsx src/index.css src/index.motion.test.ts
git commit -m "feat: add expressive motion foundation"
```

---

### Task 3: Shared Task Fields and Mobile Composer Dialog

**Files:**
- Create: `src/components/TaskComposerFields.tsx`
- Create: `src/components/TaskComposerModal.tsx`
- Create: `src/components/TaskComposerModal.test.tsx`
- Modify: `src/components/TaskInput.tsx:1-343`
- Modify: `src/index.css`

**Interfaces:**
- Produces: `TaskDraftInput = { title: string; description: string; priority: Priority; dueDate: string | null; listId: string | null; tags: string[]; reminder: string | null }`.
- Produces: `TaskComposerFields({ lists, defaultListId, defaultDueDate, autoFocus, onSubmit, onCancel })`.
- Produces: `TaskComposerModal({ open, anchorRef, lists, defaultListId, defaultDueDate, onSubmit, onClose })`.
- Consumes: `usePresenceValue`, `MOTION_MS`, and the motion CSS state selectors from Task 2.

- [ ] **Step 1: Write failing shared-form tests through the modal**

Cover these concrete behaviors:

```tsx
const onSubmit = vi.fn()
const onClose = vi.fn()
const user = userEvent.setup()

render(
  <TaskComposerModal
    open
    anchorRef={{ current: document.createElement('button') }}
    lists={[{ id: 'work', name: 'Work', color: '#00aaff', createdAt: '2026-09-04T00:00:00.000Z' }]}
    defaultListId="work"
    defaultDueDate="2026-09-04"
    onSubmit={onSubmit}
    onClose={onClose}
  />,
)

await user.type(screen.getByLabelText('Task name'), 'Ship Clarity')
await user.click(screen.getByRole('button', { name: 'Add task' }))

expect(onSubmit).toHaveBeenCalledWith(
  expect.objectContaining({ title: 'Ship Clarity', listId: 'work', dueDate: '2026-09-04' }),
)
expect(onClose).toHaveBeenCalledTimes(1)
```

Add separate tests for Cancel, backdrop-only dismissal, Escape, disabled empty
submission, and focus returning to `anchorRef.current` after exit.

- [ ] **Step 2: Run the modal tests and confirm the missing component failure**

Run: `npm test -- src/components/TaskComposerModal.test.tsx`

Expected: FAIL because `TaskComposerModal` does not exist.

- [ ] **Step 3: Extract the current form without changing its data contract**

Move task draft state, reset, validation, date shortcuts, priority controls,
category, tags, reminder, Cancel, and Add Task into
`TaskComposerFields.tsx`. Keep `fromDateTimeLocal`, tag trimming, default list,
and default due-date behavior byte-for-byte equivalent where possible.

`TaskInput.tsx` becomes a desktop wrapper: its collapsed dashed button and
disclosure remain, but the expanded region renders `TaskComposerFields`.
Remove the old scroll-to-inline-form effect from shared fields; only the
desktop wrapper may call `scrollIntoView`.

- [ ] **Step 4: Implement the modal around the shared form**

Always render `TaskComposerModal` from its owner and let `usePresenceValue`
control mounting. The mounted structure is:

```tsx
<div
  className="native-modal-viewport motion-overlay fixed inset-0 z-50"
  data-motion-state={presence.phase}
  data-testid="task-composer-backdrop"
>
  <section
    role="dialog"
    aria-modal="true"
    aria-label="Add a task"
    className="task-composer-modal motion-dialog"
    onClick={(event) => event.stopPropagation()}
  >
    <TaskComposerFields {...fieldProps} autoFocus onCancel={onClose} />
  </section>
</div>
```

Backdrop clicks close only when `event.target === event.currentTarget`.
The panel uses `transform-origin: bottom right`, a stronger accent edge glow,
internal scrolling, `max-height` based on `100dvh`, and native safe-area
padding. Stop accepting interaction once phase becomes `exiting`.

- [ ] **Step 5: Run the focused modal tests**

Run: `npm test -- src/components/TaskComposerModal.test.tsx src/components/MotionPresence.test.tsx`

Expected: PASS.

- [ ] **Step 6: Run type-check/build to catch form-interface drift**

Run: `npm run build`

Expected: TypeScript and Vite PASS.

- [ ] **Step 7: Commit the reusable composer**

```bash
git add src/components/TaskComposerFields.tsx src/components/TaskComposerModal.tsx src/components/TaskComposerModal.test.tsx src/components/TaskInput.tsx src/index.css
git commit -m "feat: add animated mobile task composer"
```

---

### Task 4: App Wiring, Floating Button Placement, and Landscape Safe Areas

**Files:**
- Modify: `src/App.tsx:1-55,129-170,247-460,466-765`
- Modify: `src/index.css:157-203,230-275`
- Modify: `src/index.motion.test.ts`
- Modify: `capacitor.config.test.ts`

**Interfaces:**
- Consumes: `TaskComposerModal`, `TaskInput`, `isNativeApp`, and `useMediaQuery('(max-width: 639px)')`.
- Produces: `const isNarrowTaskEntry = useMediaQuery('(max-width: 639px)')` followed by `const compactTaskEntry = isNativeApp || isNarrowTaskEntry` so the hook is called unconditionally.
- Preserves: `defaultListId`, `defaultDueDate`, and Favorites insertion semantics.

- [ ] **Step 1: Extend the failing CSS contract test for four-sided safe areas**

Assert these exact ownership rules in `src/index.css`:

```ts
expect(css).toContain('padding-left: env(safe-area-inset-left)')
expect(css).toContain('padding-right: env(safe-area-inset-right)')
expect(css).toContain('right: calc(1.25rem + env(safe-area-inset-right))')
expect(css).toContain('bottom: calc(4.25rem + env(safe-area-inset-bottom))')
expect(css).toContain('.native-app .native-modal-viewport')
```

Retain the Capacitor assertion that `ios.contentInset` is `never`; CSS owns
the inset exactly once.

- [ ] **Step 2: Run the CSS and Capacitor tests and verify the new assertions fail**

Run: `npm test -- src/index.motion.test.ts capacitor.config.test.ts`

Expected: FAIL on the missing horizontal inset and new FAB positions.

- [ ] **Step 3: Wire mobile/native modal and desktop inline entry**

Add a `fabRef`, call `useMediaQuery` unconditionally, compute
`compactTaskEntry` from that result and `isNativeApp`, and make `openQuickAdd`
idempotently set `true`. Render the desktop `TaskInput` only when
`!compactTaskEntry` and render `TaskComposerModal` once outside the inert
background container with `open={quickAddOpen && compactTaskEntry}`.

The same submit callback remains authoritative:

```ts
const addTaskFromComposer = (input: TaskDraftInput) => {
  store.addTask({ ...input, favorite: view === 'favorites' })
  setQuickAddOpen(false)
}
```

Set the background app container inert while the mobile composer is present,
without making the portalled/fixed composer itself inert. Close quick-add on a
view change that no longer accepts tasks.

- [ ] **Step 4: Move and stabilize the floating add button**

Attach `fabRef`, add `aria-expanded`, stop toggling closed on a second rapid
tap, and use shared `motion-primary motion-interactive` classes. CSS sets:

```css
.native-app .native-fab {
  right: calc(1.25rem + env(safe-area-inset-right));
  bottom: calc(4.25rem + env(safe-area-inset-bottom));
}
```

The non-native mobile fallback uses the equivalent `right: 1.25rem` and
`bottom: 4.25rem`. Confirm visually that the button clears the docked search
bar while sitting lower than its old 5 rem offset.

- [ ] **Step 5: Apply four-sided native safe areas once**

Add left/right padding to `.native-app .app-shell`. Give fixed native drawers,
modal viewports, and toasts explicit horizontal safe-area offsets or padding
because fixed positioning does not inherit shell padding. Clamp mobile
sidebar/panel width with:

```css
max-width: calc(
  100vw - env(safe-area-inset-left) - env(safe-area-inset-right)
);
```

Do not add a second Capacitor content inset. Ensure the app background still
paints edge-to-edge behind the protected content.

- [ ] **Step 6: Add a keyed page entrance without resetting page state**

Wrap only the routed content body—not providers or the docked search bar—in a
`motion-page` element keyed by `view`. This gives navigation a fresh entrance
while preserving stores, search, drawer state, and scroll ownership.

- [ ] **Step 7: Run targeted tests, full build, and iOS sync**

Run:

```bash
npm test -- src/index.motion.test.ts capacitor.config.test.ts src/components/TaskComposerModal.test.tsx
npm run build
npm run ios:sync
```

Expected: all commands PASS; Capacitor reports the haptics, keyboard, local
notification, and status-bar packages synchronized.

- [ ] **Step 8: Commit the iOS integration**

```bash
git add src/App.tsx src/index.css src/index.motion.test.ts capacitor.config.test.ts ios/App/CapApp-SPM/Package.swift ios/App/App/capacitor.config.json
git commit -m "feat: integrate mobile composer and landscape safe areas"
```

Only stage generated iOS files if `cap sync` actually changed them.

---

### Task 5: Native Haptic Intents and Completion Feedback

**Files:**
- Modify: `src/native/platform.ts:1-51`
- Create: `src/native/platform.test.ts`
- Modify: `src/components/TaskCheckbox.tsx:1-52`
- Modify: `src/components/HabitTracker.tsx:104-185,238-268`
- Modify: `src/components/Dropdown.tsx:25-108`
- Modify: `src/App.tsx`

**Interfaces:**
- Produces: `NativeFeedback = 'selection' | 'success' | 'warning'`.
- Produces: `nativeFeedback(kind: NativeFeedback): void`.
- Preserves aliases: `nativeSelectionHaptic()` and `nativeSuccessHaptic()`.
- Produces: `nativeWarningHaptic(): void`.

- [ ] **Step 1: Write failing feedback-mapping tests**

Export and test a pure mapper:

```ts
expect(hapticRequest('selection')).toEqual({ channel: 'impact', style: 'light' })
expect(hapticRequest('success')).toEqual({ channel: 'notification', type: 'success' })
expect(hapticRequest('warning')).toEqual({ channel: 'notification', type: 'warning' })
```

- [ ] **Step 2: Run the native helper test and confirm the missing API failure**

Run: `npm test -- src/native/platform.test.ts`

Expected: FAIL because `hapticRequest` and `nativeWarningHaptic` do not exist.

- [ ] **Step 3: Implement centralized best-effort haptics**

Map selection to `Haptics.impact({ style: ImpactStyle.Light })`, success to
`NotificationType.Success`, and warning to `NotificationType.Warning`.
Return immediately outside native Capacitor. Terminate the promise chain with
`.catch(() => undefined)` so a bridge error cannot create an unhandled
rejection or block the caller.

- [ ] **Step 4: Apply haptics only to meaningful actions**

- Opening the task composer, dropdowns, Settings, and navigation selections:
  selection.
- Completing a previously incomplete task or habit: success.
- Starting a confirmed delete/empty-trash operation: warning immediately
  before the mutation.
- Undoing or uncompleting: selection.

Do not fire haptics for text entry, scrolling, pointer movement, or every
rendered control.

- [ ] **Step 5: Run helper tests and the full suite**

Run: `npm test`

Expected: PASS; web/jsdom execution performs no Capacitor haptic call.

- [ ] **Step 6: Commit haptic behavior**

```bash
git add src/native/platform.ts src/native/platform.test.ts src/components/TaskCheckbox.tsx src/components/HabitTracker.tsx src/components/Dropdown.tsx src/App.tsx
git commit -m "feat: add expressive native haptic feedback"
```

---

### Task 6: App-Wide Overlay, Menu, Control, and Content Motion

**Files:**
- Modify: `src/components/TaskEditor.tsx:60-82`
- Modify: `src/components/Settings.tsx:105-130`
- Modify: `src/components/HabitForm.tsx:160-190`
- Modify: `src/components/HabitSummary.tsx:55-75`
- Modify: `src/components/NoteTemplates.tsx:30-60`
- Modify: `src/components/Dropdown.tsx:1-112`
- Modify: `src/components/HabitTracker.tsx:48-78,350-418`
- Modify: `src/components/BrainDump.tsx:103-135,400-790`
- Modify: `src/components/HabitCard.tsx`
- Modify: `src/components/HabitHeatmap.tsx`
- Modify: `src/components/DayDetail.tsx`
- Modify: `src/components/NoteDayDetail.tsx`
- Modify: `src/components/AmountSlider.tsx`
- Modify: `src/components/IconPicker.tsx`
- Modify: `src/components/HabitTimer.tsx`
- Modify: `src/components/LogNotes.tsx`
- Modify: `src/components/FilterMenu.tsx`
- Modify: `src/components/SortMenu.tsx`
- Modify: `src/components/AuthGate.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/Header.tsx`
- Modify: `src/components/TaskItem.tsx`
- Modify: `src/components/TaskCheckbox.tsx`
- Modify: `src/components/GlobalSearch.tsx`
- Modify: `src/components/UndoToast.tsx`
- Modify: `src/index.css`
- Modify: `src/index.motion.test.ts`

**Interfaces:**
- Consumes: `usePresenceValue<T>`, `MotionPhase`, `.motion-interactive`, `.motion-primary`, `.motion-overlay`, `.motion-dialog`, `.motion-popover`, `.motion-content`, and `.motion-page`.
- Produces: consistent `data-motion-state` on preserved overlays and menus.

- [ ] **Step 1: Extend CSS contract tests for the interaction inventory**

Assert the stylesheet contains all reusable classes used in this task and that
the Reduce Motion block resets independent `scale`, `transform`, and long
transition durations:

```ts
for (const name of [
  '.motion-interactive',
  '.motion-primary',
  '.motion-overlay',
  '.motion-dialog',
  '.motion-popover',
  '.motion-content',
  '.motion-page',
]) expect(css).toContain(name)
```

- [ ] **Step 2: Run the contract test and confirm missing classes fail**

Run: `npm test -- src/index.motion.test.ts`

Expected: FAIL for any class not completed in earlier tasks.

- [ ] **Step 3: Preserve full-screen overlays through exit**

At each state owner, call `usePresenceValue` with either the selected object or
a Boolean sentinel. Pass `phase` into the dialog component and set it on the
backdrop's `data-motion-state`. Remove entrance-only `anim-fade-in` and
`anim-scale-in` from Task Editor, Settings, Habit Form, Habit Summary, Note
Templates, Day Detail, Note Day Detail, Amount Slider, and Icon Picker; replace
them with the shared overlay/dialog or anchored-popover classes.

For object-backed dialogs, render `presence.value` during exit rather than
re-reading a now-null selection. For habit data, refresh the preserved object
from the store by ID while it is still present.

- [ ] **Step 4: Give dropdowns real exit and trigger-relative origin**

Replace the dropdown's `open && createPortal(...)` branch with preserved
presence. Compute `transformOrigin` from `align` and whether the menu flipped
above or below the trigger. Outside click, Escape, scroll, and resize request
close; they do not unmount until exit completes. Menu items become
`motion-interactive` without changing their click handlers.

- [ ] **Step 5: Apply expressive control feedback systematically**

Add `motion-interactive` to buttons, icon buttons, toggles, radios, filter
chips, checkbox surfaces, tappable habit cells, timer controls, log-note
actions, template choices, and authentication submit controls in the named
files. Add `motion-primary` only to accent-filled Add, Save, Log, Sign In, and
floating controls. Keep destructive controls red and avoid accent glow on
them. Remove local `active:scale-*` rules that would fight the shared
independent scale.

- [ ] **Step 6: Upgrade navigation and content-state motion**

- Sidebar disclosures use the shared standard duration and spring curve;
  chevrons rotate over the same duration.
- Task rows, habit cards, search results, empty states, and inline filter status
  use `.motion-content` with small stagger variables capped at the first eight
  visible items.
- Checkboxes keep their completion pop but use the stronger shared success
  glow and do not restart on unrelated renders.
- Toasts use prominent entrance and faster exit; translated centering remains
  intact by animating an inner wrapper or composing transform variables.
- Progress widths keep their semantic transition but use the standard token.

- [ ] **Step 7: Verify Reduce Motion and transform composition in tests**

Run: `npm test -- src/index.motion.test.ts src/components/MotionPresence.test.tsx src/components/TaskComposerModal.test.tsx`

Expected: PASS.

- [ ] **Step 8: Run full static verification**

Run:

```bash
npm test
npm run lint
npm run build
```

Expected: all commands PASS with no new warnings or React act messages.

- [ ] **Step 9: Commit the app-wide motion pass**

```bash
git add src/components/TaskEditor.tsx src/components/Settings.tsx src/components/HabitForm.tsx src/components/HabitSummary.tsx src/components/NoteTemplates.tsx src/components/Dropdown.tsx src/components/HabitTracker.tsx src/components/BrainDump.tsx src/components/HabitCard.tsx src/components/HabitHeatmap.tsx src/components/DayDetail.tsx src/components/NoteDayDetail.tsx src/components/AmountSlider.tsx src/components/IconPicker.tsx src/components/HabitTimer.tsx src/components/LogNotes.tsx src/components/FilterMenu.tsx src/components/SortMenu.tsx src/components/AuthGate.tsx src/components/Sidebar.tsx src/components/Header.tsx src/components/TaskItem.tsx src/components/TaskCheckbox.tsx src/components/GlobalSearch.tsx src/components/UndoToast.tsx src/index.css src/index.motion.test.ts
git commit -m "feat: polish interactive motion across Clarity"
```

---

### Task 7: Documentation, Simulator QA, and Physical iPhone Verification

**Files:**
- Modify: `src/components/Guide.tsx:130-210`
- Modify: `README.md`
- Modify if generated: `ios/App/App/capacitor.config.json`
- Modify if generated: `ios/App/CapApp-SPM/Package.swift`

**Interfaces:**
- Consumes: all completed UI behavior from Tasks 1-6.
- Produces: synchronized native bundle and a recorded, evidence-based QA result.

- [ ] **Step 1: Update user-facing documentation**

In the Guide and README, state that on iPhone the floating add button opens a
task composer, desktop retains inline quick add, Cancel/backdrop/Escape dismiss
the composer, Reduce Motion is honored, and landscape uses the iPhone safe
area. Do not mention the postponed Habits month behavior as though it exists.

- [ ] **Step 2: Run the complete repository checks**

Run:

```bash
npm test
npm run lint
npm run build
npm run ios:sync
git diff --check
```

Expected: every command exits 0. Inspect `git status --short` and confirm no
unrelated file is staged.

- [ ] **Step 3: Build for the iPhone 17 Pro simulator**

Run:

```bash
xcodebuild \
  -project ios/App/App.xcodeproj \
  -scheme App \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,id=8DF4075F-EC87-450B-B4FE-035EE4BCC608' \
  -derivedDataPath /tmp/clarity-ios-motion-simulator \
  CODE_SIGNING_ALLOWED=NO \
  build
```

Expected: `** BUILD SUCCEEDED **`.

- [ ] **Step 4: Perform simulator interaction checks**

Boot/install the built app and verify portrait, landscape-left, and
landscape-right. In each orientation check Home year, task-button/search
clearance, composer origin, keyboard-visible controls, Cancel, backdrop,
Escape, rapid open/close, task submission, sidebar swipe, Settings close,
dropdown placement, search results, completion, toasts, light/dark theme, and
Reduce Motion. Capture screenshots of portrait composer and both landscape
orientations for comparison.

- [ ] **Step 5: Build and install on the connected physical iPhone**

Run:

```bash
xcodebuild \
  -project ios/App/App.xcodeproj \
  -scheme App \
  -configuration Debug \
  -destination 'platform=iOS,id=00008110-001514593460E01E' \
  -derivedDataPath /tmp/clarity-ios-motion-device \
  build

xcrun devicectl device install app \
  --device 00008110-001514593460E01E \
  /tmp/clarity-ios-motion-device/Build/Products/Debug-iphoneos/App.app
```

Expected: `** BUILD SUCCEEDED **` followed by a successful device install.

- [ ] **Step 6: Perform physical-iPhone checks**

On `Daddy iPhone`, verify touch-down/release response, selection/success/warning
haptics, animation frame continuity during scrolling, keyboard and home
indicator clearance, both landscape notch sides, drawer swipe, and every modal
exit route. Rapidly tap the FAB and menu triggers to confirm no stacked or
invisible overlay remains. Record any defect with screen, orientation, action,
and observed result before changing code.

- [ ] **Step 7: Fix only verified defects using red-green cycles**

For each reproducible defect, add the smallest failing unit/component/CSS
contract test that captures it, run that test to confirm failure, implement the
minimal fix, rerun the focused test, then repeat Steps 2-6 in proportion to the
affected area.

- [ ] **Step 8: Commit documentation and final verified adjustments**

```bash
git add src/components/Guide.tsx README.md
git add ios/App/App/capacitor.config.json ios/App/CapApp-SPM/Package.swift 2>/dev/null || true
git commit -m "docs: document premium iOS interactions"
```

Before committing, use `git diff --cached --name-only` and unstage any generated
file that did not change as a direct result of `cap sync`.

- [ ] **Step 9: Final acceptance report**

Report the exact passing commands, simulator/device models and iOS versions,
orientations tested, screenshots captured, physical haptic results, remaining
limitations, and the final commit IDs. Do not claim physical behavior was
verified unless the app was installed and exercised on the connected phone.
