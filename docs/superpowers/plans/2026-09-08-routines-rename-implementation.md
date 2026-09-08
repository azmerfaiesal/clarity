# Routines Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the user-facing Habits feature to Routines everywhere a user sees or hears it while preserving all internal data identifiers.

**Architecture:** Treat this as a presentation-copy migration only. Update rendered headings, navigation, empty states, dialogs, accessibility labels, guide text, and README copy; leave `Habit` TypeScript types, the `habits` view ID, component filenames, storage keys, realtime channels, and Supabase tables untouched.

**Tech Stack:** React 19, TypeScript 6, Vitest, Testing Library, Tailwind CSS 4.

**Spec:** `docs/superpowers/specs/2026-09-08-recurring-tasks-routines-design.md`

## Global Constraints

- User-facing section terminology is Routines.
- Internal compatibility names remain `Habit`, `habits`, `clarity_habits`, and existing storage/realtime identifiers.
- Existing synced and offline data must remain readable without migration.
- Functional descriptions may use ordinary prose, but labels referring to the Clarity feature or one of its records use Routine/Routines.
- All production copy changes are covered by focused assertions or an explicit source audit.

---

### Task 1: Navigation, page, home, and empty-state copy

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/Home.tsx`
- Modify: `src/components/HabitTracker.tsx`
- Modify: `src/components/EmptyState.tsx`
- Modify: `src/components/HabitCard.tsx`
- Modify: `src/components/HabitForm.tsx`
- Modify: relevant existing component tests

**Interfaces:**
- Produces: visible and accessible Routines labels.
- Preserves: `view === 'habits'`, `navigateTo('habits')`, `EMPTY_PRESETS.habits`, `useHabits`, and all `Habit` model names.

- [ ] **Step 1: Add failing rendered-copy assertions**

Extend existing tests nearest each component. Required assertions include:

```ts
expect(screen.getByRole('heading', { name: 'My Routines' })).toBeVisible()
expect(screen.getByRole('button', { name: /Routines/ })).toBeVisible()
expect(screen.getByText('No routines yet.')).toBeVisible()
expect(screen.getByLabelText('Routine name')).toBeVisible()
expect(screen.getByLabelText('Routine actions')).toBeVisible()
```

If a component lacks a usable render harness, add a focused test with the smallest required context mocks. Do not add a global copy abstraction solely for testing.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
npm test -- src/components/HabitTracker.feedback.test.tsx src/components/HabitTracker.exit.test.tsx
```

Run any new focused test files in the same command. Expected: FAIL on old Habits wording.

- [ ] **Step 3: Replace visible feature labels**

Make these exact copy changes while retaining internal identifiers:

```text
My Habits            -> My Routines
Habits               -> Routines
No habits yet.       -> No routines yet.
Habit name           -> Routine name
Habit actions        -> Routine actions
habit / habits count -> routine / routines count
Habits built from it are kept. -> Routines built from it are kept.
```

Update Home's section title and sidebar label. Do not rename files, imports, variables, props, view IDs, or store methods.

- [ ] **Step 4: Run the focused component tests**

```bash
npm test -- src/components/HabitTracker.feedback.test.tsx src/components/HabitTracker.exit.test.tsx
```

Include any new tests created in Step 1. Expected: PASS.

- [ ] **Step 5: Audit source boundaries**

Run:

```bash
rg -n "My Habits|No habits yet|Habit name|Habit actions|label=\"Habits\"|title=\"Habits\"" src
rg -n "view === 'habits'|navigateTo\('habits'\)|clarity_habits|Habit" src supabase/schema.sql
```

Expected: the first command returns no user-facing legacy labels. The second command still returns internal compatibility identifiers.

- [ ] **Step 6: Commit core Routines copy**

```bash
git add src/App.tsx src/components/Sidebar.tsx src/components/Home.tsx src/components/HabitTracker.tsx src/components/EmptyState.tsx src/components/HabitCard.tsx src/components/HabitForm.tsx
git add $(git diff --name-only -- 'src/**/*.test.ts' 'src/**/*.test.tsx')
git commit -m "feat: rename Habits section to Routines"
```

Inspect staged paths before committing and preserve internal compatibility names.

---

### Task 2: Guide, onboarding, and README terminology

**Files:**
- Modify: `src/components/Guide.tsx`
- Modify: `README.md`
- Modify: `src/components/Guide.test.tsx` if created

**Interfaces:**
- Consumes: Routines product terminology from Task 1.
- Produces: documentation and onboarding copy aligned with the actual UI.

- [ ] **Step 1: Write a failing Guide heading assertion**

If Guide has no existing test, create `src/components/Guide.test.tsx` with the minimal props and assert:

```ts
expect(screen.getByText('Routines')).toBeVisible()
expect(screen.queryByText('Habits')).not.toBeInTheDocument()
```

Also assert that its navigation callback still receives the internal value `'habits'` when the Routines link is activated.

- [ ] **Step 2: Run the Guide test and verify RED**

```bash
npm test -- src/components/Guide.test.tsx
```

Expected: FAIL because Guide still renders Habits terminology.

- [ ] **Step 3: Rewrite user documentation without changing identifiers**

Update Guide and README prose to describe Routines, routine schedules, routine templates, routine reminders, and routine history. Where documentation names a literal implementation identifier such as `clarity_habits`, retain the literal exactly and explain that it is an internal compatibility name only if needed.

Also update authentication copy from `tasks, habits, and notes` to `tasks, routines, and notes` because it is user-visible.

- [ ] **Step 4: Run the documentation copy audit**

```bash
rg -n "\bHabits\b|\bhabit(s)?\b" src/components/Guide.tsx README.md
```

Expected: any remaining hits are deliberate implementation literals or historical references reviewed one by one; ordinary feature copy uses Routines.

- [ ] **Step 5: Run tests and build**

```bash
npm test -- src/components/Guide.test.tsx
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit documentation rename**

```bash
git add src/components/Guide.tsx src/components/Guide.test.tsx README.md
git commit -m "docs: adopt Routines terminology"
```

---

### Task 3: Full compatibility and device verification

**Files:**
- Verify only unless a focused failing test exposes a missed user-facing string.

**Interfaces:**
- Consumes: both rename tasks.
- Produces: evidence that the copy changed without data migration or regression.

- [ ] **Step 1: Run the complete automated suite**

```bash
npm test
npm run lint
npm run build
git diff --check
```

Expected: all tests pass; lint has no errors; build succeeds; no whitespace errors.

- [ ] **Step 2: Verify internal identifiers were preserved**

```bash
git diff -- src/types.ts src/store/storage.ts src/store/sync.ts supabase/schema.sql
rg -n "'habits'|clarity_habits|habitTemplates" src supabase/schema.sql
```

Expected: no rename migration exists; internal hits remain valid.

- [ ] **Step 3: Synchronize iOS**

```bash
npx cap sync ios
plutil -lint ios/App/App/Info.plist
```

Expected: success.

- [ ] **Step 4: Run user-facing acceptance**

In portrait and landscape on a simulator or connected iPhone, verify:

1. Sidebar shows Routines and opens the existing section.
2. The page heading says My Routines.
3. Home uses Routines.
4. Empty state, create/edit form, action menu, templates, deletion confirmation, Guide, and authentication copy use Routine/Routines.
5. Existing routine records and templates are still present after upgrade and sign-in.
6. No panel clips under the notch or status area.

- [ ] **Step 5: Record final evidence**

Report the exact test count, lint result, build result, Capacitor sync result, test surface, and any deliberate remaining internal `habit` identifiers. Do not describe internal compatibility names as unfinished rename work.
