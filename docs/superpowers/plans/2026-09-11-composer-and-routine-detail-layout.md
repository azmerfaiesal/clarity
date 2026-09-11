# Composer and Routine Detail Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bottom-center all global creation composers and give wide Routine cards a compact in-card day-detail rail while preserving the safe fixed popover on phones.

**Architecture:** Global Task, Routine, and Note creation dialogs share two semantic CSS classes for viewport placement and panel sizing while retaining their existing icon-origin animation variables. Routine cards reserve a 15rem rail only when a container query confirms enough card width; a clicked heatmap cell passes the measured rail bounds to the existing portaled `DayDetail`, which otherwise uses the existing safe viewport clamping.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4 plus project CSS, Vitest, Testing Library.

**Spec:** User-approved design in the 2026-09-11 task conversation.

## Global Constraints

- Task, Routine, and Note global-create composers settle at the bottom middle.
- Their entrance and exit retain the selected launcher icon as the spatial origin.
- The Routine side detail appears only when desktop or tablet width leaves sufficient room.
- Phone and narrow layouts retain the existing safe clamped popover.
- Routine cards are centered and no wider than the month grid plus a 15rem detail rail.
- Reduced-motion users receive a short fade without travel, scaling, blur, or glow movement.
- Preserve `graphify-out/` and `.worktrees/phased-hybrid-auth` unchanged.

---

### Task 1: Standardize global composer placement

**Files:**
- Modify: `src/components/TaskComposerModal.tsx`
- Modify: `src/components/NoteComposerModal.tsx`
- Modify: `src/components/HabitForm.tsx`
- Modify: `src/index.css`
- Test: `src/components/TaskComposerModal.test.tsx`
- Test: `src/components/NoteComposerModal.test.tsx`
- Test: `src/components/HabitTracker.exit.test.tsx`

**Interfaces:**
- Produces: `.global-composer-viewport` and `.global-composer-modal` classes used only by launcher-created dialogs.

- [x] **Step 1: Write failing component tests**

Assert that all three global-create dialogs expose the shared viewport and panel classes, while an unanchored Routine edit remains a standard centered modal.

- [x] **Step 2: Verify the tests fail for the missing shared classes**

Run: `npx vitest run src/components/TaskComposerModal.test.tsx src/components/NoteComposerModal.test.tsx src/components/HabitTracker.exit.test.tsx --maxWorkers=1 --testTimeout=20000`

- [x] **Step 3: Apply the shared classes and bottom-center CSS**

Use `align-items: flex-end`, `justify-content: center`, `width: min(100%, 32rem)`, safe-area-aware padding and `transform-origin: center bottom`; keep the existing anchor CSS variables and modal internals.

- [x] **Step 4: Verify the focused tests pass**

Run the command from Step 2 and require zero failures.

### Task 2: Add the responsive Routine day-detail rail

**Files:**
- Modify: `src/components/HabitCard.tsx`
- Modify: `src/components/HabitTracker.tsx`
- Modify: `src/components/DayDetail.tsx`
- Modify: `src/index.css`
- Test: `src/components/HabitCard.ranges.test.tsx`
- Create: `src/components/DayDetail.test.tsx`

**Interfaces:**
- Produces: `DayDetailAnchor = { x: number; y: number; rail?: { left: number; top: number; width: number; height: number } }`.
- Produces: `.routine-card`, `.routine-history-layout`, `.routine-history-grid`, and `.routine-day-detail-rail`.
- Consumes: existing heatmap cell anchor coordinates and existing safe-popover utilities.

- [x] **Step 1: Write failing tests for wide and narrow placement**

Assert that a valid rail chooses `data-placement="rail"` at the rail bounds, that an absent rail chooses `data-placement="popover"`, and that a Routine card decorates clicked anchors with its visible rail bounds.

- [x] **Step 2: Verify the focused tests fail for the absent rail behavior**

Run: `npx vitest run src/components/DayDetail.test.tsx src/components/HabitCard.ranges.test.tsx --maxWorkers=1 --testTimeout=20000`

- [x] **Step 3: Implement measured rail placement and compact card layout**

Measure the card rail at click time, ignore zero-sized hidden rails, portal `DayDetail` to `document.body`, position a rail detail at the rail's left/top, retain viewport clamping otherwise, and use a 54rem centered card with a 15rem rail activated by a 48rem container query.

- [x] **Step 4: Add premium rail motion with reduced-motion coverage**

Animate the rail panel and keyed content with opacity, horizontal translation, subtle scale, blur, and glow; remove spatial motion and filters under `prefers-reduced-motion`.

- [x] **Step 5: Verify the focused tests pass**

Run the command from Step 2 and require zero failures.

### Task 3: Regression and visual verification

**Files:**
- Modify only if verification reveals a scoped defect.

**Interfaces:**
- Consumes: all behavior from Tasks 1 and 2.

- [x] **Step 1: Run the complete main-checkout test suite**

Run: `npx vitest run --dir src --maxWorkers=1 --testTimeout=20000`

- [x] **Step 2: Run static verification**

Run: `npm run lint` and `npm run build`.

- [x] **Step 3: Inspect desktop/tablet and phone layouts**

At wide width, confirm compact centered Routine cards, an in-card right detail panel, and bottom-middle Task/Note/Routine create dialogs. At narrow width, confirm the detail stays safely clamped and composers respect safe areas.

- [x] **Step 4: Review the working-tree diff**

Confirm no changes exist under `graphify-out/` or `.worktrees/phased-hybrid-auth` and no unrelated files were modified.
