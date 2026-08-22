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
import { loadTheme, saveTheme } from './storage'

export type Theme = 'light' | 'dark'

interface ThemeState {
  theme: Theme
  setTheme: (t: Theme) => void
  toggleTheme: () => void
  /** True when a host page (the Daily Dashboard iframe) owns the theme. */
  controlledByHost: boolean
}

const ThemeContext = createContext<ThemeState | null>(null)

function applyToDocument(t: Theme) {
  document.documentElement.setAttribute('data-theme', t)
  document.documentElement.style.colorScheme = t
}

/**
 * Light is the default look; dark is opt-in via the sidebar toggle and
 * remembered. A host page embedding Clarity in an iframe can take over by
 * posting `{ type: 'theme', value: 'light' | 'dark' }`.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => loadTheme() ?? 'light')
  const [controlledByHost, setControlledByHost] = useState(false)
  const hostControlled = useRef(false)

  useEffect(() => {
    applyToDocument(theme)
  }, [theme])

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

  const value = useMemo<ThemeState>(
    () => ({
      theme,
      setTheme,
      toggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
      controlledByHost,
    }),
    [theme, setTheme, controlledByHost],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
