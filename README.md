# Clarity

A polished, minimalist to-do list web app — fast, distraction-free task capture and organization. Built with **React 19, TypeScript, Tailwind CSS 4, and Lucide icons** (Vite).

## Features

- **Quick capture** — click "Add a task" (or press `N`), type, hit `Enter`. Expand for description, due date, priority, list, tags, and reminders.
- **Views** — Inbox, Today, Upcoming (grouped by date), Completed, Favorites, and custom lists.
- **Custom lists** — create colored lists (Personal, Work, Shopping, Projects seeded); deleting a list returns its tasks to Inbox.
- **Tasks** — create, edit (modal editor), delete with **Undo** toast, complete/uncomplete, duplicate, favorite, priorities (none/low/medium/high with subtle flag indicators), tags, notes.
- **Recycle Bin** — deleted tasks move to a bin (sidebar entry with count) instead of vanishing. Restore them, delete forever (with confirmation), or empty the whole bin. Trashed tasks are hidden from every view and from search.
- **Search** — global palette (`Cmd/Ctrl + K` or `/`) matching title, description, list, and tags, with keyboard navigation.
- **Filters** — status, priority, due date, list, favorites-only, with active-count badge and one-click clear.
- **Sorting** — manual, due date, priority, date created, alphabetical.
- **Dark mode** — toggle in the sidebar footer; respects system preference on first launch.
- **Persistence** — tasks, lists, and theme stored in `localStorage` behind a small storage layer (`src/store/storage.ts`) that can be swapped for a backend without touching the UI.
- **Responsive** — desktop sidebar, mobile navigation drawer + floating Add button; no horizontal scrolling.
- **Accessible** — semantic HTML, ARIA labels/roles, visible focus rings, keyboard navigable, `prefers-reduced-motion` support.

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

Sample tasks are seeded on first launch (mixed priorities, dates, lists, and completed states). To re-seed, clear site data in your browser.

## Project structure

```
src/
  components/    Sidebar, Header, TaskList items, TaskInput (quick add),
                 TaskEditor (modal), SearchPalette, FilterMenu, SortMenu,
                 EmptyState, UndoToast, Dropdown, TaskCheckbox
  store/         taskStore.tsx (reducer + context), storage.ts (persistence
                 + sample data), theme.tsx (dark/light)
  utils/         dateUtils.ts, taskUtils.ts (view/search/filter/sort logic)
  types.ts       Task, TaskList, ViewId, Filters, SortMode
```
