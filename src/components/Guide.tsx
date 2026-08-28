import { Menu } from 'lucide-react'
import type { ViewId } from '../types'

/**
 * The manual. Its own page rather than a panel inside Settings, because it is
 * something to read and refer back to rather than a control to adjust — and
 * because a scrolling essay inside a modal is a miserable thing to use.
 */

const SHORTCUTS: [string, string][] = [
  ['N', 'New task, in any task view'],
  ['/', 'Jump to the search bar'],
  ['⌘ / Ctrl + K', 'Jump to the search bar'],
  ['Enter', 'Save a task, or add a tag while writing a note'],
  ['⌘ / Ctrl + Enter', 'Save the note you are writing'],
  ['↑ ↓', 'Move through tag suggestions'],
  ['Esc', 'Close a dialog, or cancel an edit'],
]

function Part({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-9">
      <h2 className="mb-2 text-md font-semibold tracking-[-0.01em] text-ink">{title}</h2>
      <div className="space-y-2.5 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  )
}

/** One capability: what it is, then the thing about it worth knowing. */
function Feature({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="border-l border-line py-1 pl-3.5">
      <h3 className="text-sm font-medium text-ink">{name}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted">{children}</p>
    </div>
  )
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5 text-sm leading-relaxed text-muted">
      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden />
      <span>{children}</span>
    </li>
  )
}

export function Guide({
  onOpenMobileNav,
  onNavigate,
}: {
  onOpenMobileNav: () => void
  onNavigate: (v: ViewId) => void
}) {
  const link = (v: ViewId, label: string) => (
    <button
      type="button"
      onClick={() => onNavigate(v)}
      className="cursor-pointer font-medium text-accent underline decoration-accent/30 underline-offset-2 transition-colors hover:decoration-accent"
    >
      {label}
    </button>
  )

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
            How Clarity works
          </h1>
          <p className="mt-1 font-mono text-2xs tracking-[0.06em] text-faint uppercase">
            The whole thing in one page
          </p>
        </div>
      </header>

      <Part title="What it is">
        <p>
          Clarity keeps three kinds of thing in one place: the tasks you have to do, the habits
          you are trying to keep, and the notes you write as you go. They are deliberately
          separate — a task is finished once, a habit is never finished, and a note is not asking
          anything of you at all. Most apps blur those together and end up serving none of them
          well.
        </p>
        <p>
          Everything is stored under your account and syncs to every device you sign in on. A
          device that loses its connection keeps working from its own copy and catches up when it
          can.
        </p>
      </Part>

      <Part title="Tasks">
        <div className="space-y-3">
          <Feature name="Views">
            {link('inbox', 'Inbox')} holds everything open. {link('today', 'Today')} and{' '}
            {link('upcoming', 'Upcoming')} narrow that by date, {link('favorites', 'Favorites')}{' '}
            by the star, and {link('completed', 'Completed')} looks backwards. Deleting is never
            final: tasks rest in the {link('trash', 'Recycle Bin')} until you empty it.
          </Feature>
          <Feature name="Categories">
            Colour-coded groupings in the sidebar — Personal, Work, whatever suits. A task belongs
            to at most one, and the Inbox is where the ones that belong to none of them live.
          </Feature>
          <Feature name="Due dates and reminders">
            Both are optional, and a task with neither is perfectly normal. A reminder shows a
            small clock on the task and raises a browser notification at the time you set — see
            the limitation under Notifications below.
          </Feature>
          <Feature name="Priority, tags and search">
            Three priority flags, free-form tags, and a search bar docked to the foot of every
            page — press{' '}
            <kbd className="rounded border border-line bg-surface px-1 py-0.5 font-mono text-2xs text-muted">
              /
            </kbd>{' '}
            to jump to it. It looks across task titles, descriptions,
            tags and category names, and across your notes, at once.
          </Feature>
        </div>
      </Part>

      <Part title="Habits">
        <div className="space-y-3">
          <Feature name="How often">
            Daily, particular days of the week, a number of times per week, or particular dates of
            the month. The last two matter more than they sound: “three times a week” is counted
            across the week rather than on fixed days, so a streak survives moving a session from
            Tuesday to Wednesday.
          </Feature>
          <Feature name="Timing a session">
            A habit measured in minutes gets a stopwatch: open today's box in
            the grid and start it. It keeps running if you close the popup or the
            tab — the elapsed time comes from the clock rather than a counter — and
            stopping logs the whole session to the day, rounded to the nearest
            minute. Reset throws the session away without logging it.
          </Feature>
          <Feature name="What counts as done">
            A simple tick, a target count (eight glasses of water), or a target duration (thirty
            minutes of reading). A partial day still shows colour in the grid — it was worked on —
            but it does not count towards the streak, because a streak that counted three glasses
            out of eight would be lying to you.
          </Feature>
          <Feature name="The grid">
            Each card shows its history as This month, This quarter, or the last 365 days, and
            remembers which you last chose. Today's box wears a ring that breathes. Click any day
            to open it, log it after the fact, or write a line about what you did.
          </Feature>
          <Feature name="Streaks">
            Counted in days, or in weeks for a “× per week” habit. A day that is still open never
            breaks a streak — only a day that has actually passed unmet does.
          </Feature>
          <Feature name="Templates">
            Under Habits in the sidebar. Suggestions to start from, plus anything you save as a
            template yourself, which you can then edit or remove. A template is a blueprint: it
            makes new habits and is not linked to the ones already made from it.
          </Feature>

        </div>
      </Part>

      <Part title="Notes">
        <div className="space-y-3">
          <Feature name="A blank sheet">
            No title, no folder, no structure. Write, tag if you feel like it, save. The composer
            sits at the foot of the page under what you have already written.
          </Feature>
          <Feature name="Tags">
            The only organisation there is. Start typing and Clarity offers the tags you already
            use, so “work” does not quietly become “Work” and “werk”. The sidebar lists every tag
            with a count, as a way back in.
          </Feature>
          <Feature name="The writing streak">
            A grid of the days you wrote something, at the top of this page rather than under
            Habits, since it is a picture of these notes. It ticks itself and is derived rather
            than recorded, so notes written before you started tracking still count and deleting
            one takes its day back. Click any day to see what you wrote then — four at a time,
            with pages if there were more.
          </Feature>
          <Feature name="Nothing is lost">
            A note in progress is kept as you type, so closing the tab mid-thought costs nothing.
            Clicking an earlier note opens it in the same composer rather than a dialog.
          </Feature>
        </div>
      </Part>

      <Part title="Making it yours">
        <div className="space-y-3">
          <Feature name="Appearance">
            Light or dark, nine accent colours including four pastels, four text sizes and five
            typefaces. These are per device — a phone at night and a laptop by a window do not
            want the same settings.
          </Feature>
          <Feature name="Week starts on">
            Sunday or Monday. Not only cosmetic: it decides the week a “× per week” habit counts
            against, so a streak can shift when you change it.
          </Feature>
          <Feature name="Notifications">
            Reminders arrive while a Clarity tab is open, in the foreground or the background.
            They cannot reach you with the browser closed — that needs a push server this app does
            not have. Worth knowing before you rely on one.
          </Feature>
        </div>
      </Part>

      <Part title="Getting the most out of it">
        <ul className="space-y-2.5" role="list">
          <Tip>
            <strong className="font-medium text-ink">Put it on your home screen.</strong> On a
            phone, Share → Add to Home Screen gives you an icon and a full screen, and it behaves
            like an app from then on.
          </Tip>
          <Tip>
            <strong className="font-medium text-ink">Let the Inbox be a dumping ground.</strong>{' '}
            Capture first and sort later. A task you did not write down is worse than one in the
            wrong category.
          </Tip>
          <Tip>
            <strong className="font-medium text-ink">Start with two habits, not eight.</strong>{' '}
            The grid is honest, and eight rows of mostly-missed days is discouraging in a way that
            two rows of mostly-kept ones is not. Add more once the first two are boring.
          </Tip>
          <Tip>
            <strong className="font-medium text-ink">Use “× per week” for anything you do not
            do daily.</strong> Fixed days punish an ordinary rearranged week; a weekly quota does
            not.
          </Tip>
          <Tip>
            <strong className="font-medium text-ink">Keep a handful of tags, not dozens.</strong>{' '}
            Tags earn their keep by being reused. Take the suggestion when it appears.
          </Tip>
          <Tip>
            <strong className="font-medium text-ink">Check Settings if something looks out of
            date.</strong> The Account section says plainly whether syncing is working, and shows
            what the server said if it is not.
          </Tip>
        </ul>
      </Part>

      <Part title="Keyboard shortcuts">
        <dl className="space-y-1.5">
          {SHORTCUTS.map(([key, action]) => (
            <div key={key} className="flex items-baseline justify-between gap-4">
              <dt className="text-sm text-muted">{action}</dt>
              <dd className="shrink-0">
                <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-2xs text-muted">
                  {key}
                </kbd>
              </dd>
            </div>
          ))}
        </dl>
      </Part>
    </>
  )
}
