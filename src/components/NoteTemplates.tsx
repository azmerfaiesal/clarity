import { useEffect } from 'react'
import { X } from 'lucide-react'
import { NOTE_TEMPLATES, type NoteTemplate } from '../store/noteTemplates'

/**
 * The template picker for the note composer.
 *
 * Each row shows the shape it will insert rather than only naming it — the
 * whole reason to pick one is what it looks like, and a list of names asks you
 * to try them one at a time to find out.
 */
export function NoteTemplates({
  onPick,
  onClose,
  /** True when the composer has text: picking then appends rather than fills. */
  hasContent,
}: {
  onPick: (template: NoteTemplate) => void
  onClose: () => void
  hasContent: boolean
}) {
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

  return (
    <div
      className="anim-fade-in fixed inset-0 z-50 flex items-end justify-center bg-[var(--scrim)] backdrop-blur-[3px] sm:items-center sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Note templates"
        onClick={(e) => e.stopPropagation()}
        className="anim-scale-in flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-xl border border-line bg-raised shadow-2xl shadow-black/20 sm:rounded-xl dark:shadow-black/70"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-3.5">
          <div className="min-w-0">
            <span className="text-sm font-medium text-ink">Templates</span>
            <p className="mt-0.5 text-xs text-faint">
              {hasContent
                ? 'Added below what you have already written.'
                : 'A starting shape for the things you write often.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close templates"
            className="-mr-1.5 shrink-0 cursor-pointer rounded-lg p-1.5 text-faint transition-colors hover:bg-surface hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <ul className="space-y-2" role="list">
            {NOTE_TEMPLATES.map((template) => (
              <li key={template.id}>
                <button
                  type="button"
                  onClick={() => onPick(template)}
                  className="w-full cursor-pointer rounded-lg border border-line px-3.5 py-3 text-left transition-colors hover:border-accent/50 hover:bg-accent-soft"
                >
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-medium text-ink">{template.name}</span>
                    {template.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded border border-accent/30 px-1.5 py-px font-mono text-3xs text-accent/80"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-muted">{template.blurb}</p>
                  {/* The shape itself, trimmed to the first few lines — long
                      enough to recognise, short enough not to become the list. */}
                  <pre className="mt-2 overflow-hidden font-mono text-3xs whitespace-pre-wrap text-faint">
                    {previewOf(template.body)}
                  </pre>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

const PREVIEW_LINES = 5

function previewOf(body: string): string {
  const lines = body.split('\n')
  const shown = lines.slice(0, PREVIEW_LINES).join('\n')
  return lines.length > PREVIEW_LINES ? `${shown}\n…` : shown
}
