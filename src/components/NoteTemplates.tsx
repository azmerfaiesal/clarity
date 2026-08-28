import { useEffect, useState } from 'react'
import { Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import { useNotes, type TemplateEdit } from '../store/noteStore'
import { type NoteTemplate } from '../store/noteTemplates'

/**
 * The template picker for the note composer.
 *
 * Each row shows the shape it will insert rather than only naming it — the
 * whole reason to pick one is what it looks like, and a list of names asks you
 * to try them one at a time to find out.
 *
 * The six shipped shapes are a guess at what people log; they are not going to
 * be right for anyone in particular. So every one of them can be rewritten, put
 * away, or joined by your own — and a rewritten built-in can always be put back
 * the way it came, because only the edit is stored, never the original.
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
  const { templates, saveTemplate, removeTemplate, resetTemplate } = useNotes()
  /** null = the list; a template = editing it; 'new' = writing one. */
  const [editing, setEditing] = useState<NoteTemplate | 'new' | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      // Escape backs out of the form first, then closes the dialog.
      if (editing) setEditing(null)
      else onClose()
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose, editing])

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
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <div className="min-w-0">
            <span className="text-sm font-medium text-ink">
              {editing === 'new'
                ? 'New template'
                : editing
                  ? `Editing ${editing.name}`
                  : 'Templates'}
            </span>
            <p className="mt-0.5 text-xs text-faint">
              {editing
                ? 'A line ending in a space is where the caret lands.'
                : hasContent
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

        {editing ? (
          <TemplateForm
            template={editing === 'new' ? null : editing}
            onCancel={() => setEditing(null)}
            onSave={async (edit) => {
              await saveTemplate(editing === 'new' ? null : editing.id, edit)
              setEditing(null)
            }}
          />
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <ul className="space-y-2" role="list">
                {templates.map((template) => (
                  <li key={template.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => onPick(template)}
                      className="w-full cursor-pointer rounded-lg border border-line py-3 pr-24 pl-3.5 text-left transition-colors hover:border-accent/50 hover:bg-accent-soft"
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
                        {template.edited && (
                          <span className="font-mono text-3xs text-faint">edited</span>
                        )}
                      </div>
                      {template.blurb && (
                        <p className="mt-1 text-xs text-muted">{template.blurb}</p>
                      )}
                      {/* The shape itself, trimmed to the first few lines — long
                          enough to recognise, short enough not to become the list. */}
                      <pre className="mt-2 overflow-hidden font-mono text-3xs whitespace-pre-wrap text-faint">
                        {previewOf(template.body)}
                      </pre>
                    </button>

                    <div className="absolute top-2.5 right-2.5 flex items-center gap-0.5">
                      {template.edited && (
                        <button
                          type="button"
                          onClick={() => void resetTemplate(template.id)}
                          aria-label={`Reset ${template.name} to how it shipped`}
                          title="Back to how it shipped"
                          className="cursor-pointer rounded p-1.5 text-faint transition-colors hover:bg-surface hover:text-ink"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setEditing(template)}
                        aria-label={`Edit ${template.name}`}
                        className="cursor-pointer rounded p-1.5 text-faint transition-colors hover:bg-surface hover:text-ink"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const question = template.custom
                            ? `Delete the “${template.name}” template?`
                            : `Hide the “${template.name}” template? You can bring it back by resetting it.`
                          if (window.confirm(question)) void removeTemplate(template.id)
                        }}
                        aria-label={
                          template.custom
                            ? `Delete ${template.name}`
                            : `Hide ${template.name}`
                        }
                        className="cursor-pointer rounded p-1.5 text-faint transition-colors hover:bg-danger-soft hover:text-danger"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              {templates.length === 0 && (
                <p className="px-3 py-8 text-center text-xs text-muted">
                  Every template is hidden. Add one below, or reset one from a fresh install.
                </p>
              )}
            </div>

            <div className="shrink-0 border-t border-line px-3 py-2.5">
              <button
                type="button"
                onClick={() => setEditing('new')}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-accent/50 hover:text-ink"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                New template
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function TemplateForm({
  template,
  onSave,
  onCancel,
}: {
  template: NoteTemplate | null
  onSave: (edit: TemplateEdit) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(template?.name ?? '')
  const [blurb, setBlurb] = useState(template?.blurb ?? '')
  const [tags, setTags] = useState((template?.tags ?? []).join(', '))
  const [body, setBody] = useState(template?.body ?? '')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!name.trim() || busy) return
    setBusy(true)
    try {
      await onSave({
        name,
        blurb,
        body,
        tags: tags
          .split(',')
          .map((t) => t.trim().replace(/^#/, '').toLowerCase())
          .filter(Boolean),
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Coffee brew"
            className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />
        </Field>

        <Field label="Description">
          <input
            value={blurb}
            onChange={(e) => setBlurb(e.target.value)}
            placeholder="What it is for — shown under the name."
            className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />
        </Field>

        <Field label="Tags">
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="coffee, morning"
            className="w-full rounded-md border border-line bg-surface px-3 py-2 font-mono text-xs text-ink outline-none focus:border-accent"
          />
        </Field>

        <Field label="Body">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={12}
            placeholder={'Bean: \nDose: g'}
            className="block w-full resize-y rounded-md border border-line bg-surface px-3 py-2 font-mono text-xs leading-relaxed text-ink outline-none focus:border-accent"
          />
        </Field>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-3 py-2.5">
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer rounded-md border border-line px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-surface hover:text-ink"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!name.trim() || busy}
          className="cursor-pointer rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-ink transition-all hover:bg-accent-hi hover:glow-sm disabled:cursor-not-allowed disabled:opacity-40"
        >
          Save template
        </button>
      </div>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-2xs font-semibold tracking-wide text-faint uppercase">
        {label}
      </span>
      {children}
    </label>
  )
}

const PREVIEW_LINES = 5

function previewOf(body: string): string {
  const lines = body.split('\n')
  const shown = lines.slice(0, PREVIEW_LINES).join('\n')
  return lines.length > PREVIEW_LINES ? `${shown}\n…` : shown
}
