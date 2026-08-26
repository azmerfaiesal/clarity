import { useEffect, useState } from 'react'
import {
  ALargeSmall,
  BellRing,
  CalendarDays,
  Check,
  ChevronDown,
  Cloud,
  CloudOff,
  Moon,
  Palette,
  RefreshCw,
  TriangleAlert,
  Sun,
  Type,
  X,
} from 'lucide-react'
import { useAuth } from '../store/auth'
import { useTaskStore } from '../store/taskStore'
import { FONT_SIZE_LABELS, useTheme, type FontSize } from '../store/theme'
import type { WeekStart } from '../utils/habitUtils'
import { permissionState, requestPermission, type PermissionState } from '../store/notifications'
import { DEFAULT_FONT, FONTS, FONT_KEYS, ensureFontLoaded, type FontKey } from '../store/fonts'
import { ACCENTS, ACCENT_KEYS, accentSwatch } from '../store/accents'
import { clearSyncError, useSyncHealth } from '../store/syncHealth'
import { formatRelative } from '../utils/dateUtils'

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
 <h3 className="mb-2.5 text-2xs font-semibold tracking-wider text-faint uppercase">
        {title}
      </h3>
      {children}
    </section>
  )
}

export function Settings({ onClose }: { onClose: () => void }) {
  const {
    theme,
    setTheme,
    controlledByHost,
    fontSize,
    setFontSize,
    fontFamily,
    setFontFamily,
    weekStartsOn,
    setWeekStartsOn,
    accent,
    setAccent,
  } = useTheme()
  const [notifyState, setNotifyState] = useState<PermissionState>(() => permissionState())
  const { user, signOut } = useAuth()
  const store = useTaskStore()
  const sync = useSyncHealth()

  useEffect(() => {
    FONT_KEYS.forEach(ensureFontLoaded)
  }, [])

  // Permission can be changed from the browser's own site settings while this
  // panel is open, so re-read it whenever the window comes back into focus.
  useEffect(() => {
    const sync = () => setNotifyState(permissionState())
    window.addEventListener('focus', sync)
    document.addEventListener('visibilitychange', sync)
    return () => {
      window.removeEventListener('focus', sync)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [])

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
 className="anim-fade-in fixed inset-0 z-50 flex justify-start bg-[var(--scrim)] backdrop-blur-[3px]"
      onClick={onClose}
      role="presentation"
    >
      {/* A drawer pinned to the left edge, full height. The panel stops short of
          the viewport width on purpose, so there is always a strip of the app
          left to click on to dismiss it. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={(e) => e.stopPropagation()}
 className="anim-drawer-in-left h-full w-[86vw] max-w-md overflow-y-auto rounded-r-xl border-r border-line bg-raised shadow-xl shadow-black/20 dark:shadow-black/70"
      >
 <div className="flex items-center justify-between px-5 pt-5 pb-1">
 <h2 className="text-md font-semibold tracking-tight text-ink">
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
 className={`flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
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
            <p className="mt-2 text-xs text-faint">
              The theme is being set by the dashboard this is embedded in.
            </p>
          )}

          <div className="mt-4">
            <div className="mb-2 flex items-center gap-1.5 text-xs text-muted">
              <Palette className="h-3.5 w-3.5 text-faint" aria-hidden />
              Accent colour
            </div>
            <div
              role="radiogroup"
              aria-label="Accent colour"
              className="flex flex-wrap gap-1.5"
            >
              {ACCENT_KEYS.map((key) => {
                const on = accent === key
                // The swatch shows the tone for the theme in use, because the
                // two members of a hue look quite different from each other.
                const colour = accentSwatch(key, theme)
                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={ACCENTS[key].label}
                    title={ACCENTS[key].label}
                    onClick={() => setAccent(key)}
                    className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border transition-transform hover:scale-105 ${
                      on ? 'border-ink/25' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: colour }}
                  >
                    {on && (
                      <Check
                        className="h-4 w-4"
                        strokeWidth={3}
                        style={{ color: ACCENTS[key][theme].ink }}
                      />
                    )}
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-xs text-faint">
              {ACCENTS[accent].label}
              {ACCENTS[accent].pastel ? ' · pastel' : ''} — recoloured per theme so it stays
              readable as text as well as a button.
            </p>
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center gap-1.5 text-xs text-muted">
              <ALargeSmall className="h-4 w-4 text-faint" aria-hidden />
              Text size
            </div>
            <div
              role="radiogroup"
              aria-label="Text size"
              className="inline-flex rounded-md border border-line p-0.5"
            >
              {(['sm', 'md', 'lg', 'xl'] as FontSize[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  role="radio"
                  aria-checked={fontSize === f}
                  onClick={() => setFontSize(f)}
                  className={`cursor-pointer rounded-md px-3 py-1.5 font-medium transition-colors ${
                    fontSize === f ? 'bg-accent-soft text-ink' : 'text-muted hover:text-ink'
                  }`}
                  // Each option previews its own scale, so the choice is legible
                  // before it is made. Fixed px on purpose: these must not scale.
                  style={{ fontSize: `${11 + (['sm', 'md', 'lg', 'xl'].indexOf(f) * 1.5)}px` }}
                >
                  {FONT_SIZE_LABELS[f]}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-faint">
              Scales every label in the app. Saved on this device.
            </p>
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center gap-1.5 text-xs text-muted">
              <Type className="h-3.5 w-3.5 text-faint" aria-hidden />
              Typeface
            </div>
            <div className="relative">
              <select
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value as FontKey)}
                aria-label="Typeface"
                className="w-full cursor-pointer appearance-none rounded-md border border-line bg-surface py-2 pr-8 pl-3 text-sm text-ink outline-none focus:border-accent"
                // The closed control previews the face it names.
                style={{ fontFamily: FONTS[fontFamily].stack }}
              >
                {FONT_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {FONTS[key].label}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-faint"
                aria-hidden
              />
              <p className="mt-1.5 text-xs text-faint">{FONTS[fontFamily].note}</p>
            </div>
            {fontFamily !== DEFAULT_FONT && (
              <p className="mt-2 text-xs text-faint">
                The Daily Dashboard embeds Clarity in {FONTS[DEFAULT_FONT].label}; this choice
                applies here only.
              </p>
            )}
          </div>
        </Section>

        <Section title="Reminders">
          <p className="text-sm text-muted">
            Get a notification when a task reminder comes due, or when a habit is still open at its
            reminder time.
          </p>
          {notifyState === 'unsupported' ? (
            <p className="mt-3 text-sm text-muted">
              This browser does not support notifications.
            </p>
          ) : notifyState === 'needs-install' ? (
            // iOS hides the notification API from an ordinary Safari tab
            // entirely. Saying "unsupported" here was true of the tab and
            // wrong about the phone, and left nothing to do about it.
            <>
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-sm font-medium text-faint">
                <BellRing className="h-3.5 w-3.5" aria-hidden />
                Add Clarity to your Home Screen first
              </span>
              <p className="mt-2 text-xs text-faint">
                iOS only offers notifications to an installed web app. Tap Share, then “Add to Home
                Screen”, and open Clarity from there — this panel will offer the permission prompt.
              </p>
            </>
          ) : notifyState === 'granted' ? (
            // The control stays put once permission is given and simply reads
            // as done — a button that vanishes leaves you wondering whether the
            // click registered.
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-success/40 bg-success-soft px-3 py-1.5 text-sm font-medium text-success">
              <BellRing className="h-3.5 w-3.5" aria-hidden />
              Notifications enabled
            </span>
          ) : notifyState === 'denied' ? (
            <>
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-sm font-medium text-faint">
                <BellRing className="h-3.5 w-3.5" aria-hidden />
                Notifications blocked
              </span>
              <p className="mt-2 text-xs text-faint">
                Re-allow them in your browser's site settings; this panel picks the change up when
                you come back to the tab.
              </p>
            </>
          ) : (
            <button
              type="button"
              onClick={async () => setNotifyState(await requestPermission())}
              className="mt-3 cursor-pointer rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink transition-all hover:bg-accent-hi"
            >
              Enable notifications
            </button>
          )}
          <p className="mt-2 text-xs text-faint">
            Reminders fire while Clarity is running — a foreground tab, a background tab, or the
            installed app. They cannot reach you once it is closed entirely; that needs a push
            server this app does not have.
          </p>
        </Section>

        <Section title="Calendar">
          <div className="mb-2 flex items-center gap-1.5 text-xs text-muted">
            <CalendarDays className="h-3.5 w-3.5 text-faint" aria-hidden />
            Week starts on
          </div>
          <div
            role="radiogroup"
            aria-label="First day of the week"
            className="inline-flex rounded-md border border-line p-0.5"
          >
            {([0, 1] as WeekStart[]).map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={weekStartsOn === d}
                onClick={() => setWeekStartsOn(d)}
                className={`cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  weekStartsOn === d ? 'bg-accent-soft text-ink' : 'text-muted hover:text-ink'
                }`}
              >
                {d === 0 ? 'Sunday' : 'Monday'}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-faint">
            Sets the row order in every habit grid, and the week a “× per week” habit counts
            against — so a streak can shift when you change it.
          </p>
        </Section>

        <Section title="Account">
          {user ? (
            <>
 <div className="flex items-center gap-2 text-sm text-ink">
                {sync.ok === false ? (
 <TriangleAlert className="h-4 w-4 text-danger" aria-hidden />
                ) : store.ready ? (
 <Cloud className="h-4 w-4 text-success" aria-hidden />
                ) : (
 <CloudOff className="h-4 w-4 text-faint" aria-hidden />
                )}
 <span className="truncate">{user.email}</span>
              </div>
              {/* The state this used to claim unconditionally. A write the
                  server refuses will never succeed on a retry, so saying
                  nothing about it left a device quietly out of step. */}
              {sync.ok === false ? (
                <>
                  <p className="mt-1 text-xs text-danger">
                    Not syncing — changes are saved on this device only.
                  </p>
                  {sync.lastError && (
                    <p className="mt-1 font-mono text-3xs break-words text-faint">
                      {sync.lastError}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      clearSyncError()
                      window.location.reload()
                    }}
 className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-ink"
                  >
 <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                    Try again
                  </button>
                </>
              ) : (
 <p className="mt-1 text-xs text-faint">
                  {!store.ready
                    ? 'Connecting…'
                    : sync.lastOkAt
                      ? `Syncing across your devices · last ${formatRelative(sync.lastOkAt)}`
                      : 'Syncing across your devices.'}
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  onClose()
                  void signOut()
                }}
 className="mt-3 cursor-pointer rounded-md border border-line px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-surface"
              >
                Sign out
              </button>
            </>
          ) : (
 <p className="text-sm text-muted">
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
 <dd className="text-lg font-semibold tabular-nums text-ink">
                  {value}
                </dd>
 <dt className="text-2xs text-faint">{label}</dt>
              </div>
            ))}
          </dl>

 <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={completed === 0}
              onClick={() => store.clearCompleted()}
 className="cursor-pointer rounded-md border border-line px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
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
 className="cursor-pointer rounded-md border border-line px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:border-danger/40 hover:bg-danger-soft hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
            >
              Empty recycle bin
            </button>
          </div>
        </Section>

        <Section title="Keyboard shortcuts">
 <dl className="space-y-1.5">
            {SHORTCUTS.map(([key, action]) => (
 <div key={key} className="flex items-center justify-between">
 <dt className="text-sm text-muted">{action}</dt>
                <dd>
 <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-2xs text-muted">
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
