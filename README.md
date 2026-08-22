# Clarity

A polished, minimalist to-do list web app — fast, distraction-free task capture that syncs across every device you sign in on. Built with **React 19, TypeScript, Tailwind CSS 4, Supabase and Lucide icons** (Vite).

Live at **https://azmerfaiesal.github.io/clarity/**

## Features

- **Quick capture** — click "Add a task" (or press `N`), type, hit `Enter`. The form stays open so you can add several in a row. Expand for description, due date, priority, list, tags, and reminders.
- **Views** — Inbox, Today, Upcoming (grouped by date), Completed, Favorites, Recycle Bin, and custom lists.
- **Custom lists** — create colored lists (Personal, Work, Shopping, Projects seeded); deleting a list returns its tasks to Inbox.
- **Tasks** — create, edit (modal editor), complete/uncomplete, duplicate, favorite, priorities (none/low/medium/high with subtle flag indicators), tags, notes.
- **Recycle Bin** — deleting a task moves it to the bin, with a 6-second **Undo** toast. Restore from the bin, delete forever, or empty it. "Clear completed" also moves to the bin rather than destroying anything. Trashed tasks are hidden from every view and from search.
- **Search** — global palette (`Cmd/Ctrl + K` or `/`) matching title, description, list, and tags, with keyboard navigation.
- **Filters** — status, priority, due date, list, favorites-only, with active-count badge and one-click clear.
- **Sorting** — manual, due date, priority, date created, alphabetical.
- **Settings** — appearance, account and sync status, task counts, bulk actions, and the keyboard-shortcut reference.
- **Light and dark** — light by default; the sidebar toggle switches and remembers your choice.
- **Responsive** — desktop sidebar, mobile navigation drawer + floating Add button; no horizontal scrolling.
- **Accessible** — semantic HTML, ARIA labels/roles, visible focus rings, keyboard navigable, `prefers-reduced-motion` support.

## Sync

Sign in with email + password (Supabase Auth). Everything then lives in two Postgres tables, `clarity_tasks` and `clarity_lists`, behind row-level security that scopes every row to `auth.uid()`.

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
                 Settings, EmptyState, UndoToast, Dropdown, TaskCheckbox,
                 AuthGate
  store/         taskStore.tsx (reducer + sync orchestration), sync.ts
                 (Supabase read/write/realtime), storage.ts (scoped
                 localStorage + sample data), auth.tsx, theme.tsx
  lib/           supabase.ts (client)
  utils/         dateUtils.ts, taskUtils.ts (view/search/filter/sort logic)
  types.ts       Task, TaskList, ViewId, Filters, SortMode
supabase/
  schema.sql     tables, RLS policies, realtime publication
```
