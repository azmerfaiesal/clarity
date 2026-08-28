/**
 * UI typeface options, in two families.
 *
 * The first five sit with the theme — geometric, technical, or terminal. The
 * next five are for reading and writing at length, which is what the Notes page
 * actually is: book faces, where a long entry reads as prose rather than as
 * interface.
 *
 * Both groups have to clear the same bar: readable at 11–13px, which is where
 * most of this app lives. That is what rules out the obvious journal faces —
 * EB Garamond and friends have small x-heights that turn a task list to mush at
 * this size, however handsome they look at 40px. The ones here were picked for
 * holding up small: Literata and Source Serif were drawn for screen body text,
 * and Lora and Newsreader keep enough weight in the thin strokes to survive it.
 *
 * The metadata face stays JetBrains Mono throughout; only the UI face changes.
 */

export type FontKey =
  | 'grotesk'
  | 'chakra'
  | 'exo'
  | 'plex'
  | 'mono'
  | 'lora'
  | 'literata'
  | 'newsreader'
  | 'sourceserif'
  | 'karla'

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

  // ---- for writing at length ----
  literata: {
    label: 'Literata',
    note: 'Drawn for reading on screen. The steadiest of the serifs here.',
    stack: '"Literata", Georgia, "Times New Roman", serif',
    query: 'Literata:opsz,wght@7..72,400;7..72,500;7..72,600;7..72,700',
  },
  lora: {
    label: 'Lora',
    note: 'A serif with brushed strokes. Warm without being ornate.',
    stack: '"Lora", Georgia, "Times New Roman", serif',
    query: 'Lora:wght@400;500;600;700',
  },
  newsreader: {
    label: 'Newsreader',
    note: 'Literary and slightly old-fashioned. Long entries read as prose.',
    stack: '"Newsreader", Georgia, "Times New Roman", serif',
    query: 'Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600;6..72,700',
  },
  sourceserif: {
    label: 'Source Serif 4',
    note: 'Plain and even. A notebook rather than a novel.',
    stack: '"Source Serif 4", Georgia, "Times New Roman", serif',
    query: 'Source+Serif+4:opsz,wght@8..60,400;8..60,500;8..60,600;8..60,700',
  },
  karla: {
    label: 'Karla',
    note: 'Humanist sans — the journalling feel without the serifs.',
    stack: '"Karla", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
    query: 'Karla:wght@400;500;600;700',
  },
}

export const FONT_KEYS = Object.keys(FONTS) as FontKey[]

/**
 * The two families, for a picker that shows them as two. A flat list of ten
 * asks the reader to work out which half is which from the names alone.
 */
export const FONT_GROUPS: { label: string; keys: FontKey[] }[] = [
  { label: 'Interface', keys: ['grotesk', 'chakra', 'exo', 'plex', 'mono'] },
  { label: 'For writing', keys: ['literata', 'lora', 'newsreader', 'sourceserif', 'karla'] },
]

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
