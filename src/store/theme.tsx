import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { loadFontScale, loadTheme, saveFontScale, saveTheme } from './storage'

export type Theme = 'light' | 'dark'
export type FontSize = 'sm' | 'md' | 'lg' | 'xl'

/**
 * Multipliers for `--fs`, which every size in the type scale is expressed
 * against (see the `@theme` block in index.css). Padding and icon sizes stay
 * fixed, so raising this grows the text within the existing layout rather
 * than zooming the whole page.
 */
export const FONT_SCALES: Record<FontSize, number> = {
  sm: 0.9,
  md: 1,
  lg: 1.15,
  xl: 1.3,
}

export const FONT_SIZE_LABELS: Record<FontSize, string> = {
  sm: 'Small',
  md: 'Default',
  lg: 'Large',
  xl: 'Larger',
}

interface AppearanceState {
  theme: Theme
  setTheme: (t: Theme) => void
  toggleTheme: () => void
  /** True when a host page (the Daily Dashboard iframe) owns the theme. */
  controlledByHost: boolean
  fontSize: FontSize
  setFontSize: (f: FontSize) => void
}

const ThemeContext = createContext<AppearanceState | null>(null)

function applyTheme(t: Theme) {
  document.documentElement.setAttribute('data-theme', t)
  document.documentElement.style.colorScheme = t
}

function applyFontSize(f: FontSize) {
  document.documentElement.style.setProperty('--fs', String(FONT_SCALES[f]))
}

/**
 * Light is the default look; dark is opt-in via the sidebar toggle and
 * remembered, as is the text size. A host page embedding Clarity in an iframe
 * can take over the theme by posting `{ type: 'theme', value: 'light' | 'dark' }`.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => loadTheme() ?? 'light')
  const [fontSize, setFontSizeState] = useState<FontSize>(() => loadFontScale() ?? 'md')
  const [controlledByHost, setControlledByHost] = useState(false)
  const hostControlled = useRef(false)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    applyFontSize(fontSize)
  }, [fontSize])

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type !== 'theme') return
      const value = e.data.value
      if (value !== 'light' && value !== 'dark') return
      hostControlled.current = true
      setControlledByHost(true)
      setThemeState(value)
    }
    window.addEventListener('message', onMessage)

    if (window.parent !== window) {
      window.parent.postMessage({ type: 'clarity:ready' }, '*')
    }

    return () => window.removeEventListener('message', onMessage)
  }, [])

  const setTheme = useCallback((t: Theme) => {
    saveTheme(t)
    setThemeState(t)
  }, [])

  const setFontSize = useCallback((f: FontSize) => {
    saveFontScale(f)
    setFontSizeState(f)
  }, [])

  const value = useMemo<AppearanceState>(
    () => ({
      theme,
      setTheme,
      toggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
      controlledByHost,
      fontSize,
      setFontSize,
    }),
    [theme, setTheme, controlledByHost, fontSize, setFontSize],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): AppearanceState {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
