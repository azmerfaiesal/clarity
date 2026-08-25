# Clarity

A polished, minimalist to-do list web app — fast, distraction-free task capture that syncs across every device you sign in on. Built with **React 19, TypeScript, Tailwind CSS 4, Supabase and Lucide icons** (Vite).

Live at **https://azmerfaiesal.github.io/clarity/**

## Features

- **Quick capture** — click "Add a task" (or press `N`), type, hit `Enter`. The form stays open so you can add several in a row. Expand for description, due date, priority, list, tags, and reminders. Only the title is required — a task can carry no due date and no reminder, and both are clearable after the fact.
- **Sections** — Home, Tasks, Habits and Notes. Task views (Inbox, Today, Upcoming, Completed, Favorites, Recycle Bin) and lists appear beneath Tasks while that section is active.
- **Custom lists** — create colored lists (Personal, Work, Shopping, Projects seeded); rename or recolor one from the pencil that appears on hover; deleting a list returns its tasks to Inbox.
- **Tasks** — create, edit (modal editor), complete/uncomplete, duplicate, favorite, priorities (none/low/medium/high with subtle flag indicators), tags, notes, and reminders (shown on the row as a clock).
- **Recycle Bin** — deleting a task moves it to the bin, with a 6-second **Undo** toast. Restore from the bin, delete forever, or empty it. "Clear completed" also moves to the bin rather than destroying anything. Trashed tasks are hidden from every view and from search.
- **Home** — today at a glance: habits due (tickable in place), tasks due, recent notes, each linking through to the section that owns it.
- **Habits** — daily, weekdays, weekends, picked days, X-per-week or monthly habits, each with a 365-day contribution heatmap, a colour, emoji and optional target streak. One tap logs today. Track by a tick, a **target count** (eight glasses of water) or a **target duration** (thirty minutes reading); the heatmap ramps in four steps as the day fills. Tap the button to add a step, hold it for a slider that sets an exact amount and takes a note on what the session was. Habits can be reordered by dragging, saved as reusable **templates**, given a daily reminder, and a **Writing** habit is derived from the notes themselves, so its history reflects when each note was written and a deleted note takes its day back. Clicking a habit opens a read-only summary of its record; clicking a day in its heatmap opens that day — what happened, where it sits in its streak, and notes describing the day's logs. Each card shows current streak, lifetime total, best streak, completion rate and progress through the current period. Habits can be paused (keeping their history) or deleted.
- **Notes** — a blank sheet for whatever is on your mind: start typing straight away, tag it if you feel like it, `Cmd/Ctrl + Enter` to save. Free-form tags, chronological history with two-line previews, search across text and tags, tag filtering, and inline editing that reuses the same writing surface instead of a dialog. Unsaved text survives a refresh.
- **Search** — global palette (`Cmd/Ctrl + K` or `/`) matching title, description, list, and tags, with keyboard navigation.
- **Filters** — status, priority, due date, list, favorites-only, with active-count badge and one-click clear.
- **Sorting** — manual, due date, priority, date created, alphabetical.
- **Settings** — appearance, account and sync status, task counts, bulk actions, and the keyboard-shortcut reference.
- **Light and dark** — light by default; the sidebar toggle switches and remembers your choice. Both are the same design, not two designs.
- **Responsive** — desktop sidebar, mobile navigation drawer + floating Add button; no horizontal scrolling.
- **Accessible** — semantic HTML, ARIA labels/roles, visible focus rings, keyboard navigable, `prefers-reduced-motion` support.

## Design

Futuristic: a cool near-black (or cool paper) shell under a faint engineering
grid, hairline structure instead of soft shadows, and four luminous hues that
each own exactly one job.

| Hue | Meaning |
| --- | --- |
| Cyan | Interactive — active view, focus ring, primary button, due today |
| Fluorescent green | Done and healthy — completed tasks, sync OK, low urgency |
| Amber | Medium urgency |
| Red | High urgency, overdue, destructive |
| Neon pink | Starred, and nothing else |

Green / amber / red therefore double as the priority ramp, which is the reading
most people already have. Nothing is coloured for decoration alone — pink was
added because the star used to borrow amber, so a favourite and a
medium-priority task read as the same signal. In light mode each hue is a
deepened version of the same colour so it can carry text at AA; in dark they
run at full luminance.

Every colour is a semantic token (`--ink`, `--accent`, `--success`, `--p-med`, …)
declared once in `src/index.css` and re-declared under `[data-theme="dark"]`.
Components use them through Tailwind utilities (`bg-surface`, `text-ink`,
`border-line`), so theming happens purely in the cascade — there is no `dark:`
variant anywhere except where elevation genuinely differs.

Every text token clears WCAG AA (4.5:1) against both the base and surface
backgrounds, in both themes.

### Typeface

Settings → Appearance offers five UI faces, each row previewed in itself:

| Face | Feel |
| --- | --- |
| **Space Grotesk** (default) | Geometric with odd details. Matches the Daily Dashboard. |
| **Chakra Petch** | Angular and squared off — the most obviously sci-fi. |
| **Exo 2** | Rounded technological. Softer, still forward-looking. |
| **IBM Plex Sans** | Engineered and neutral. Easiest to read for long lists. |
| **JetBrains Mono** | Everything monospaced — one instrument panel. |

All five stay readable at 11–13px, which is where most of this app lives.
Display faces that look the part at 40px but fall apart in a task list
(Orbitron and similar) were left out on purpose. The metadata face stays
JetBrains Mono regardless; only the UI face changes.

Only the default pair is requested in `index.html`. Other faces load on demand
— and when one is already chosen, the request is issued from the pre-paint
script so it downloads during first paint rather than after hydration.
Registry: `src/store/fonts.ts`.

### Text size

Settings → Appearance offers Small / Default / Large / Larger. The whole type
scale is declared as `calc(<px> * var(--fs))`, so one variable rescales every
label in the app; padding and icons stay put, which grows the text *within* the
layout rather than zooming the page. The choice is stored per device and
applied before first paint, so there is no reflow on load.

This is why the codebase uses named sizes (`text-sm`) rather than arbitrary
ones (`text-[13px]`) — an arbitrary px size cannot respond to the preference.
Adding one silently opts that element out of the setting.

### Reminders

Tasks carry a reminder instant; habits carry a local `HH:MM` that recurs on the
days they are due. Enable notifications in Settings and Clarity raises a browser
notification when a task reminder comes due, or when a habit is still open at
its time. Firing is deduplicated in `localStorage`, so a reload does not
re-announce and a habit nags once a day rather than every sweep.

> **They fire while a Clarity tab is open** — foreground or background — and not
> when the browser is closed. That would need a service worker with a push
> subscription and a server to send from, which this app does not have.

## Sync

Sign in with email + password (Supabase Auth). Everything then lives in four Postgres tables — `clarity_tasks`, `clarity_lists`, `clarity_notes` and `clarity_habits` — behind row-level security that scopes every row to `auth.uid()`.

- **Local first** — every edit hits React state immediately and is cached in `localStorage`, so the UI never waits on the network.
- **Push** — changed rows only are upserted 400ms after an edit settles; rows removed locally are deleted server-side by the same pass.
- **Pull** — the account's rows are read once at sign-in, then Postgres realtime streams other devices' changes in. Server rows win per id; rows only this device knows about (created offline) survive the merge.
- **Per-account cache** — the `localStorage` cache is namespaced by user id and cleared on sign out, so one account's tasks are never visible to the next person signing in on the same browser.

`supabase/schema.sql` is the full setup: tables, indexes, RLS policies, and the realtime publication.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `N` | New task |
| `/` | Search |
| `Cmd/Ctrl + K` | Search palette |
| `Enter` | Create/save task |
| `Esc` | Close dialog / menu |

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
npm run test     # unit tests (streak/scheduling logic)
npm run preview  # serve the production build
```

> **Do not run this from a Google Drive / iCloud synced folder.** Cloud-streamed
> filesystems stall on `node_modules`, and Vite will hang before it binds a port.
> Keep the checkout on local disk.

### Configuration

`src/lib/supabase.ts` reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, falling back to the project's own values so the app builds without a `.env`. CI injects them from repository secrets of the same names.

Optional `.env.local` for UI work without touching real data:

```bash
VITE_LOCAL_ONLY=1   # dev only: skip sign-in, run against localStorage
```

Sample tasks are seeded on first launch (mixed priorities, dates, lists, and completed states) for signed-out sessions and brand-new accounts.

## Deployment

Pushing to `main` runs `.github/workflows/deploy.yml`, which builds and publishes to GitHub Pages.

## Project structure

```
src/
  components/    Sidebar, Header, TaskItem, TaskInput (quick add),
                 TaskEditor (modal), SearchPalette, FilterMenu, SortMenu,
                 Settings, BrainDump, EmptyState, UndoToast, Dropdown,
                 TaskCheckbox, AuthGate
  store/         taskStore.tsx (reducer + sync orchestration), noteStore.tsx
                 (Brain Dump notes), sync.ts (Supabase read/write/realtime),
                 storage.ts (scoped localStorage + sample data), auth.tsx,
                 theme.tsx, fonts.ts
  lib/           supabase.ts (client)
  utils/         dateUtils.ts, taskUtils.ts (view/search/filter/sort logic),
                 habitUtils.ts (scheduling + streak maths, unit-tested)
  types.ts       Task, TaskList, ViewId, Filters, SortMode
supabase/
  schema.sql     tables, RLS policies, realtime publication
```
