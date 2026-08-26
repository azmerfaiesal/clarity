/**
 * Accent colours.
 *
 * `--accent` does double duty across the app: it fills buttons and it *is* text
 * ("text-accent" on links, counts and active labels). One colour cannot be
 * legible in both roles on both backgrounds, so every accent carries two
 * members of its hue — a deep one for the light theme and a bright or pastel
 * one for the dark theme — plus the ink that sits on top of a fill. This is the
 * rule the original cyan already followed; it is only written down here.
 *
 * The pastel options are pastel where pastel reads: as the tint behind soft
 * surfaces in light mode, and at full strength in dark mode, where a pale hue
 * on near-black is the most legible thing on the screen.
 */

export type AccentKey =
  | 'cyan'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'violet'
  | 'mint'
  | 'peach'
  | 'lilac'
  | 'sky'

export const DEFAULT_ACCENT: AccentKey = 'cyan'

interface Tone {
  /** Fill and text colour. */
  accent: string
  /** Hover state for a filled control. */
  hi: string
  /** Text/icon colour that sits on an `--accent` fill. */
  ink: string
  /** `r g b` triplet, used to mix the soft tint, the glow and the bloom. */
  rgb: string
}

interface AccentOption {
  label: string
  /** True for the four pastel families, which are grouped in the picker. */
  pastel: boolean
  light: Tone
  dark: Tone
}

export const ACCENTS: Record<AccentKey, AccentOption> = {
  cyan: {
    label: 'Cyan',
    pastel: false,
    light: { accent: '#097589', hi: '#075e6e', ink: '#ffffff', rgb: '9 117 137' },
    dark: { accent: '#3ddbf0', hi: '#6ce8f8', ink: '#04141a', rgb: '61 219 240' },
  },
  emerald: {
    label: 'Emerald',
    pastel: false,
    light: { accent: '#0f7a45', hi: '#0b5f36', ink: '#ffffff', rgb: '15 122 69' },
    dark: { accent: '#3bff9e', hi: '#7dffbf', ink: '#04160c', rgb: '59 255 158' },
  },
  amber: {
    label: 'Amber',
    pastel: false,
    light: { accent: '#8f5d00', hi: '#714900', ink: '#ffffff', rgb: '143 93 0' },
    dark: { accent: '#ffb020', hi: '#ffc75c', ink: '#1a1002', rgb: '255 176 32' },
  },
  rose: {
    label: 'Rose',
    pastel: false,
    light: { accent: '#c62741', hi: '#a01d33', ink: '#ffffff', rgb: '198 39 65' },
    dark: { accent: '#ff4d5e', hi: '#ff8590', ink: '#1a0407', rgb: '255 77 94' },
  },
  violet: {
    label: 'Violet',
    pastel: false,
    light: { accent: '#6d28d9', hi: '#5a1fb4', ink: '#ffffff', rgb: '109 40 217' },
    dark: { accent: '#a78bfa', hi: '#c4b1fd', ink: '#100722', rgb: '167 139 250' },
  },
  mint: {
    label: 'Pastel mint',
    pastel: true,
    light: { accent: '#12796b', hi: '#0d5e53', ink: '#ffffff', rgb: '18 121 107' },
    dark: { accent: '#9df0d8', hi: '#c2f7e8', ink: '#041a15', rgb: '157 240 216' },
  },
  peach: {
    label: 'Pastel peach',
    pastel: true,
    light: { accent: '#a75234', hi: '#874128', ink: '#ffffff', rgb: '167 82 52' },
    dark: { accent: '#ffc2a3', hi: '#ffd8c4', ink: '#1d0d05', rgb: '255 194 163' },
  },
  lilac: {
    label: 'Pastel lilac',
    pastel: true,
    light: { accent: '#7b4bb5', hi: '#643a95', ink: '#ffffff', rgb: '123 75 181' },
    dark: { accent: '#d7bdfa', hi: '#e6d5fd', ink: '#140a22', rgb: '215 189 250' },
  },
  sky: {
    label: 'Pastel sky',
    pastel: true,
    light: { accent: '#1a6ba8', hi: '#135386', ink: '#ffffff', rgb: '26 107 168' },
    dark: { accent: '#a9d8ff', hi: '#cbe7ff', ink: '#04121f', rgb: '169 216 255' },
  },
}

export const ACCENT_KEYS = Object.keys(ACCENTS) as AccentKey[]

/**
 * Write the accent onto the root element.
 *
 * These land as inline styles, which outrank the `:root` and `[data-theme]`
 * blocks in index.css — so this has to run again whenever the theme flips, or
 * the light tone would stay on a dark page.
 */
export function applyAccent(key: AccentKey, theme: 'light' | 'dark'): void {
  const tone = (ACCENTS[key] ?? ACCENTS[DEFAULT_ACCENT])[theme]
  const s = document.documentElement.style
  s.setProperty('--accent', tone.accent)
  s.setProperty('--accent-hi', tone.hi)
  s.setProperty('--accent-ink', tone.ink)
  s.setProperty('--accent-soft', `rgb(${tone.rgb} / ${theme === 'dark' ? 0.11 : 0.1})`)
  s.setProperty('--glow', `rgb(${tone.rgb} / ${theme === 'dark' ? 0.32 : 0.22})`)
  // The top-left bloom is the accent's own light spilling onto the page.
  s.setProperty('--bloom-a', `rgb(${tone.rgb} / ${theme === 'dark' ? 0.055 : 0.07})`)
}

/** The colour to paint a swatch for `key` under the theme in use. */
export function accentSwatch(key: AccentKey, theme: 'light' | 'dark'): string {
  return ACCENTS[key][theme].accent
}
