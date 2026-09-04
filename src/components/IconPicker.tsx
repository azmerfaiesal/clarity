import { Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { EMOJI, ICON_GROUPS, searchIcons } from './HabitIcon'
import type { MotionPhase } from '../utils/motion'

/**
 * Icon chooser: curated line icons with search, or an emoji tab. Opens as a
 * popover under the trigger and closes on outside click or Escape.
 */
export function IconPicker({
  value,
  color,
  onPick,
  onClose,
  phase,
}: {
  value: string
  color: string
  onPick: (icon: string) => void
  onClose: () => void
  phase: MotionPhase
}) {
  const [tab, setTab] = useState<'icons' | 'emoji'>(value && !value.startsWith('lucide:') ? 'emoji' : 'icons')
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const interactive = phase !== 'exiting'

  useEffect(() => {
    if (!interactive) return
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [interactive, onClose])

  const found = searchIcons(query)
  const groups = query.trim() ? [{ label: `${found.length} matches`, icons: found }] : ICON_GROUPS

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Choose icon"
      inert={!interactive}
      data-motion-state={phase}
      className="motion-popover absolute top-full left-0 z-50 mt-1.5 w-[19rem] origin-top-left overflow-hidden rounded-lg border border-line bg-raised shadow-2xl shadow-black/30 dark:shadow-black/70"
    >
      <div className="flex border-b border-line" role="tablist">
        {(['icons', 'emoji'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`motion-interactive flex-1 cursor-pointer py-2 text-xs font-medium capitalize transition-colors ${
              tab === t
                ? 'border-b-2 border-accent text-ink'
                : 'text-muted hover:text-ink'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'icons' ? (
        <>
          <div className="flex items-center gap-2 border-b border-line px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden />
            <input
              autoFocus={interactive}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search icons… (e.g. gym, water, read)"
              aria-label="Search icons"
              className="w-full bg-transparent text-xs text-ink outline-none placeholder:text-faint"
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-2">
            {groups.map((g) => (
              <div key={g.label} className="mb-2 last:mb-0">
                <span className="label mb-1 block px-1">{g.label}</span>
                <div className="grid grid-cols-7 gap-1">
                  {g.icons.map(([key, Icon, alias]) => (
                    <button
                      key={key}
                      type="button"
                      title={alias}
                      aria-label={alias}
                      onClick={() => {
                        if (interactive) onPick(`lucide:${key}`)
                      }}
                      className={`motion-interactive flex h-9 cursor-pointer items-center justify-center rounded-md ${
                        value === `lucide:${key}`
                          ? 'bg-accent-soft'
                          : 'text-muted hover:bg-surface hover:text-ink'
                      }`}
                      style={value === `lucide:${key}` ? { color } : undefined}
                    >
                      <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {query.trim() && found.length === 0 && (
              <p className="px-1 py-4 text-center text-xs text-faint">No icons match “{query}”.</p>
            )}
          </div>
        </>
      ) : (
        <div className="grid max-h-64 grid-cols-7 gap-1 overflow-y-auto p-2">
          <button
            type="button"
            onClick={() => {
              if (interactive) onPick('')
            }}
            aria-label="No icon"
            className={`motion-interactive flex h-9 cursor-pointer items-center justify-center rounded-md text-xs ${
              value === '' ? 'bg-accent-soft text-accent' : 'text-faint hover:bg-surface'
            }`}
          >
            –
          </button>
          {EMOJI.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => {
                if (interactive) onPick(e)
              }}
              aria-label={`Emoji ${e}`}
              className={`motion-interactive flex h-9 cursor-pointer items-center justify-center rounded-md text-base ${
                value === e ? 'bg-accent-soft' : 'hover:bg-surface'
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
