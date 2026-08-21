import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

type Theme = 'light' | 'dark'

const ThemeContext = createContext<{ theme: Theme } | null>(null)

/**
 * Theme provider that syncs with the parent (Daily Dashboard) via postMessage.
 * The parent owns the theme and sends { type: 'theme', value: 'light'|'dark' }.
 * This provider listens and applies the theme to the document.
 * If not embedded, it falls back to system preference + localStorage.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    let themeFromParent = false

    const apply = (t: Theme) => {
      document.documentElement.setAttribute('data-theme', t)
      setTheme(t)
    }

    // Listen for theme from parent
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'theme') {
        themeFromParent = true
        apply(e.data.value)
      }
    }
    window.addEventListener('message', onMessage)

    // If embedded, ask parent for theme
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'clarity:ready' }, '*')
    }

    // Fallback: localStorage or system preference
    const saved = localStorage.getItem('clarity.theme') as Theme | null
    const system = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    apply(themeFromParent ? theme : (saved ?? system))

    // Listen for system preference changes (only if not controlled by parent)
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (!themeFromParent) {
        apply(media.matches ? 'dark' : 'light')
      }
    }
    media.addEventListener('change', onChange)

    // Track if parent has sent theme
    const onParentTheme = (e: MessageEvent) => {
      if (e.data?.type === 'theme') {
        themeFromParent = true
      }
    }
    window.addEventListener('message', onParentTheme)

    return () => {
      window.removeEventListener('message', onMessage)
      window.removeEventListener('message', onParentTheme)
      media.removeEventListener('change', onChange)
    }
  }, [])

  return (
    <ThemeContext.Provider value={{ theme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}