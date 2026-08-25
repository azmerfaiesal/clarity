import { Plus, X } from 'lucide-react'
import { useState } from 'react'

/**
 * The short notes describing a day's logs — "Strength training", "Running".
 *
 * Shared by the log slider and the day popup so both behave the same way:
 * Enter or blur commits, Escape abandons, and an empty entry is dropped rather
 * than stored as a blank bullet.
 */
export function LogNotes({
  notes,
  onChange,
  editable = true,
  placeholder = 'e.g. Strength training',
}: {
  notes: string[]
  onChange: (notes: string[]) => void
  editable?: boolean
  placeholder?: string
}) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')

  const commit = () => {
    const v = draft.trim()
    if (v) onChange([...notes, v])
    setDraft('')
    setAdding(false)
  }

  if (!editable && notes.length === 0) return null

  return (
    <div>
      {notes.length > 0 && (
        <ul className="space-y-0.5" role="list">
          {notes.map((n, i) => (
            <li key={`${n}-${i}`} className="group flex items-start gap-1.5 text-xs text-ink">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-faint" aria-hidden />
              <span className="min-w-0 flex-1 break-words">{n}</span>
              {editable && (
                <button
                  type="button"
                  onClick={() => onChange(notes.filter((_, j) => j !== i))}
                  aria-label={`Remove note ${n}`}
                  className="shrink-0 cursor-pointer rounded p-0.5 text-faint opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:text-danger"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {editable &&
        (adding ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commit()
              }
              if (e.key === 'Escape') {
                e.stopPropagation()
                setAdding(false)
                setDraft('')
              }
            }}
            onBlur={commit}
            placeholder={placeholder}
            aria-label="Add a note for this day"
            maxLength={60}
            className="mt-1 w-full rounded border border-line bg-surface px-2 py-1 text-xs text-ink outline-none placeholder:text-faint focus:border-accent"
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-1 inline-flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-3xs text-faint transition-colors hover:text-accent"
          >
            <Plus className="h-3 w-3" /> Add note
          </button>
        ))}
    </div>
  )
}
