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
 <section className="border-t border-line px-5 py-4 first:border-t-0">
 <h3 className="mb-2.5 text-[11px] font-semibold tracking-wider text-faint uppercase">
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
 className="anim-fade-in fixed inset-0 z-50 flex items-end justify-center bg-[var(--scrim)] backdrop-blur-[3px] sm:items-center sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={(e) => e.stopPropagation()}
 className="anim-scale-in max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-xl border border-line bg-raised shadow-xl shadow-black/20 sm:rounded-xl dark:shadow-black/70"
      >
 <div className="flex items-center justify-between px-5 pt-5 pb-1">
 <h2 className="text-[16px] font-semibold tracking-tight text-ink">
            Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
 className="-mr-1.5 cursor-pointer rounded-lg p-1.5 text-faint transition-colors hover:bg-surface hover:text-ink"
          >
 <X className="h-4 w-4" />
          </button>
        </div>

        <Section title="Appearance">
          <div
            role="radiogroup"
            aria-label="Color theme"
 className="inline-flex rounded-md border border-line p-0.5"
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
                    ? 'bg-accent-soft text-ink'
                    : 'text-muted hover:text-ink'
                }`}
              >
 {t === 'light' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                {t === 'light' ? 'Light' : 'Dark'}
              </button>
            ))}
          </div>
          {controlledByHost && (
 <p className="mt-2 text-[12px] text-faint">
              The theme is being set by the dashboard this is embedded in.
            </p>
          )}
        </Section>

        <Section title="Account">
          {user ? (
            <>
 <div className="flex items-center gap-2 text-[13px] text-ink">
                {store.ready ? (
 <Cloud className="h-4 w-4 text-accent" aria-hidden />
                ) : (
 <CloudOff className="h-4 w-4 text-faint" aria-hidden />
                )}
 <span className="truncate">{user.email}</span>
              </div>
 <p className="mt-1 text-[12px] text-faint">
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
 className="mt-3 cursor-pointer rounded-md border border-line px-3 py-1.5 text-[13px] font-medium text-muted transition-colors hover:bg-surface"
              >
                Sign out
              </button>
            </>
          ) : (
 <p className="text-[13px] text-muted">
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
 className="rounded-md border border-line py-2.5"
              >
 <dd className="text-[18px] font-semibold tabular-nums text-ink">
                  {value}
                </dd>
 <dt className="text-[11px] text-faint">{label}</dt>
              </div>
            ))}
          </dl>

 <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={completed === 0}
              onClick={() => store.clearCompleted()}
 className="cursor-pointer rounded-md border border-line px-3 py-1.5 text-[13px] font-medium text-muted transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
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
 className="cursor-pointer rounded-md border border-line px-3 py-1.5 text-[13px] font-medium text-muted transition-colors hover:border-danger/40 hover:bg-danger-soft hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
            >
              Empty recycle bin
            </button>
          </div>
        </Section>

        <Section title="Keyboard shortcuts">
 <dl className="space-y-1.5">
            {SHORTCUTS.map(([key, action]) => (
 <div key={key} className="flex items-center justify-between">
 <dt className="text-[13px] text-muted">{action}</dt>
                <dd>
 <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[11px] text-muted">
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
