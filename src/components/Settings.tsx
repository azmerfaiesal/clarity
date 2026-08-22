import { useEffect } from 'react'
import { Cloud, CloudOff, Moon, Sun, X } from 'lucide-react'
import { useAuth } from '../store/auth'
import { useTaskStore } from '../store/taskStore'
import { useTheme } from '../store/theme'

const SHORTCUTS: [string, string][] = [
  ['N', 'New task'],
  ['/', 'Search'],
  ['⌘ / Ctrl + K', 'Search palette'],
  ['Enter', 'Save task'],
  ['Esc', 'Close dialog'],
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-neutral-200/70 px-5 py-4 first:border-t-0 dark:border-neutral-800">
      <h3 className="mb-2.5 text-[11px] font-semibold tracking-wider text-neutral-400 uppercase dark:text-neutral-500">
        {title}
      </h3>
      {children}
    </section>
  )
}

export function Settings({ onClose }: { onClose: () => void }) {
  const { theme, setTheme, controlledByHost } = useTheme()
  const { user, signOut } = useAuth()
  const store = useTaskStore()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const active = store.tasks.filter((t) => !t.completed && t.deletedAt === null).length
  const completed = store.tasks.filter((t) => t.completed && t.deletedAt === null).length
  const trashed = store.tasks.filter((t) => t.deletedAt !== null).length

  return (
    <div
      className="anim-fade-in fixed inset-0 z-50 flex items-end justify-center bg-neutral-950/30 backdrop-blur-[2px] sm:items-center sm:p-6 dark:bg-black/50"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={(e) => e.stopPropagation()}
        className="anim-scale-in max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-neutral-200 bg-white shadow-xl shadow-neutral-900/10 sm:rounded-2xl dark:border-neutral-700/70 dark:bg-neutral-900 dark:shadow-black/50"
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-1">
          <h2 className="text-[16px] font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="-mr-1.5 cursor-pointer rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <Section title="Appearance">
          <div
            role="radiogroup"
            aria-label="Color theme"
            className="inline-flex rounded-lg border border-neutral-200 p-0.5 dark:border-neutral-700"
          >
            {(['light', 'dark'] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={theme === t}
                disabled={controlledByHost}
                onClick={() => setTheme(t)}
                className={`flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  theme === t
                    ? 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100'
                    : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
                }`}
              >
                {t === 'light' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                {t === 'light' ? 'Light' : 'Dark'}
              </button>
            ))}
          </div>
          {controlledByHost && (
            <p className="mt-2 text-[12px] text-neutral-400 dark:text-neutral-500">
              The theme is being set by the dashboard this is embedded in.
            </p>
          )}
        </Section>

        <Section title="Account">
          {user ? (
            <>
              <div className="flex items-center gap-2 text-[13px] text-neutral-700 dark:text-neutral-300">
                {store.ready ? (
                  <Cloud className="h-4 w-4 text-emerald-500" aria-hidden />
                ) : (
                  <CloudOff className="h-4 w-4 text-neutral-400" aria-hidden />
                )}
                <span className="truncate">{user.email}</span>
              </div>
              <p className="mt-1 text-[12px] text-neutral-400 dark:text-neutral-500">
                {store.ready
                  ? 'Tasks sync automatically across your devices.'
                  : 'Connecting…'}
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose()
                  void signOut()
                }}
                className="mt-3 cursor-pointer rounded-lg border border-neutral-200 px-3 py-1.5 text-[13px] font-medium text-neutral-600 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                Sign out
              </button>
            </>
          ) : (
            <p className="text-[13px] text-neutral-500 dark:text-neutral-400">
              Not signed in — tasks are stored on this device only.
            </p>
          )}
        </Section>

        <Section title="Tasks">
          <dl className="grid grid-cols-3 gap-2 text-center">
            {[
              ['Active', active],
              ['Completed', completed],
              ['In bin', trashed],
            ].map(([label, value]) => (
              <div
                key={label as string}
                className="rounded-lg border border-neutral-200/70 py-2.5 dark:border-neutral-800"
              >
                <dd className="text-[18px] font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                  {value}
                </dd>
                <dt className="text-[11px] text-neutral-400 dark:text-neutral-500">{label}</dt>
              </div>
            ))}
          </dl>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={completed === 0}
              onClick={() => store.clearCompleted()}
              className="cursor-pointer rounded-lg border border-neutral-200 px-3 py-1.5 text-[13px] font-medium text-neutral-600 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              Clear completed
            </button>
            <button
              type="button"
              disabled={trashed === 0}
              onClick={() => {
                if (
                  window.confirm(
                    'Permanently delete all tasks in the recycle bin? This cannot be undone.',
                  )
                ) {
                  store.emptyTrash()
                }
              }}
              className="cursor-pointer rounded-lg border border-neutral-200 px-3 py-1.5 text-[13px] font-medium text-neutral-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-red-900 dark:hover:bg-red-950/30 dark:hover:text-red-400"
            >
              Empty recycle bin
            </button>
          </div>
        </Section>

        <Section title="Keyboard shortcuts">
          <dl className="space-y-1.5">
            {SHORTCUTS.map(([key, action]) => (
              <div key={key} className="flex items-center justify-between">
                <dt className="text-[13px] text-neutral-600 dark:text-neutral-400">{action}</dt>
                <dd>
                  <kbd className="rounded-md border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-sans text-[11px] text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400">
                    {key}
                  </kbd>
                </dd>
              </div>
            ))}
          </dl>
        </Section>
      </div>
    </div>
  )
}
