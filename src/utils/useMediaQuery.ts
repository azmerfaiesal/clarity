import { useSyncExternalStore } from 'react'

/**
 * Whether a media query currently matches, kept in step with the browser.
 *
 * Used to pick a layout rather than to style one — CSS handles anything that
 * is only a matter of appearance. This is for the cases where a phone wants a
 * genuinely different arrangement of the same data.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    // No window on the server; assume the roomier layout.
    () => false,
  )
}
