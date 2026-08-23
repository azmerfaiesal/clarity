/**
 * UI typeface options.
 *
 * Chosen to sit with the theme — geometric, technical, or terminal — while
 * staying readable at 11–13px, which is where most of this app lives. Display
 * faces that look the part at 40px but fall apart in a task list (Orbitron and
 * friends) are deliberately excluded.
 *
 * The metadata face stays JetBrains Mono throughout; only the UI face changes.
 */

export type FontKey = 'grotesk' | 'chakra' | 'exo' | 'plex' | 'mono'

interface FontOption {
  label: string
  /** One line on what it feels like, shown under the name. */
  note: string
  /** Full CSS stack, assigned to --ui-font. */
  stack: string
  /**
   * `family=` fragment for the Google Fonts CSS2 API, or null when the face is
   * already requested by index.html and needs no extra round trip.
   */
  query: string | null
}

export const FONTS: Record<FontKey, FontOption> = {
  grotesk: {
    label: 'Space Grotesk',
    note: 'Geometric with odd details. Matches the Daily Dashboard.',
    stack: '"Space Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
    query: null,
  },
  chakra: {
    label: 'Chakra Petch',
    note: 'Angular and squared off — the most obviously sci-fi of the five.',
    stack: '"Chakra Petch", "Space Grotesk", -apple-system, "Segoe UI", Helvetica, Arial, sans-serif',
    query: 'Chakra+Petch:wght@400;500;600;700',
  },
  exo: {
    label: 'Exo 2',
    note: 'Rounded technological. Softer than Chakra, still forward-looking.',
    stack: '"Exo 2", "Space Grotesk", -apple-system, "Segoe UI", Helvetica, Arial, sans-serif',
    query: 'Exo+2:wght@400;500;600;700',
  },
  plex: {
    label: 'IBM Plex Sans',
    note: 'Engineered and neutral. The easiest to read for long lists.',
    stack: '"IBM Plex Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
    query: 'IBM+Plex+Sans:wght@400;500;600;700',
  },
  mono: {
    label: 'JetBrains Mono',
    note: 'Everything monospaced — the app reads as one instrument panel.',
    stack: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    // index.html only requests 400/500; headings need the heavier cuts.
    query: 'JetBrains+Mono:wght@400;500;600;700',
  },
}

export const FONT_KEYS = Object.keys(FONTS) as FontKey[]

export const DEFAULT_FONT: FontKey = 'grotesk'

/**
 * Append the stylesheet for a face, once. Fonts load on demand rather than all
 * five upfront — the default pair is already in the document head, so the
 * common case costs nothing.
 */
export function ensureFontLoaded(key: FontKey): void {
  const option = FONTS[key]
  if (!option?.query) return
  const id = `clarity-font-${key}`
  if (document.getElementById(id)) return
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${option.query}&display=swap`
  document.head.appendChild(link)
}

export function applyFont(key: FontKey): void {
  const option = FONTS[key] ?? FONTS[DEFAULT_FONT]
  ensureFontLoaded(key)
  document.documentElement.style.setProperty('--ui-font', option.stack)
}
