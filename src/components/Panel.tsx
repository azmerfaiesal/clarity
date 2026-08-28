/**
 * The panel: one bordered surface, used by every page for its content.
 *
 * It exists because the alternative was three copies of the same Tailwind
 * string in three files, which is how "the same box" quietly becomes three
 * slightly different boxes. Tasks, Notes and Home all compose these, so a
 * change to the surface happens once.
 *
 * Three pieces rather than one component with a dozen props: the shell, the
 * heading row fixed to its top edge, and the body. Notes needs a scrolling body
 * between a header and a footer, Upcoming needs one panel per date, Home needs
 * a header with an action in it — a single closed component would have needed
 * an escape hatch for each of them.
 */

const SURFACE =
  'rounded-lg border border-line bg-raised shadow-sm shadow-black/5 dark:shadow-black/40'

export function Panel({
  label,
  className = '',
  ref,
  children,
}: {
  /** Names the region for screen readers where the heading does not. */
  label?: string
  className?: string
  /** React 19 takes `ref` as an ordinary prop — no forwardRef wrapper needed. */
  ref?: React.Ref<HTMLElement>
  children: React.ReactNode
}) {
  return (
    <section ref={ref} aria-label={label} className={`${SURFACE} ${className}`}>
      {children}
    </section>
  )
}

export function PanelHeader({
  className = '',
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={`flex shrink-0 items-center gap-2 border-b border-line px-4 py-2.5 ${className}`}
    >
      {children}
    </div>
  )
}

export function PanelBody({
  className = 'p-2',
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return <div className={className}>{children}</div>
}
