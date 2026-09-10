import { useLayoutEffect, type RefObject } from 'react'

export function useComposerAnchor(
  anchorRef: RefObject<HTMLElement | null>,
  dialogRef: RefObject<HTMLElement | null>,
  active = true,
) {
  useLayoutEffect(() => {
    if (!active) return
    const anchor = anchorRef.current
    const dialog = dialogRef.current
    if (!anchor || !dialog) return

    const positionFromAnchor = () => {
      dialog.style.setProperty('transition', 'none')
      dialog.style.setProperty('transform', 'none')
      dialog.style.setProperty('scale', '1')
      const anchorBox = anchor.getBoundingClientRect()
      const dialogBox = dialog.getBoundingClientRect()
      dialog.style.removeProperty('transition')
      dialog.style.removeProperty('transform')
      dialog.style.removeProperty('scale')

      const x = anchorBox.left + anchorBox.width / 2 - (dialogBox.left + dialogBox.width / 2)
      const y = anchorBox.top + anchorBox.height / 2 - (dialogBox.top + dialogBox.height / 2)
      dialog.style.setProperty('--composer-anchor-x', `${Math.round(x)}px`)
      dialog.style.setProperty('--composer-anchor-y', `${Math.round(y)}px`)
    }

    positionFromAnchor()
    window.addEventListener('resize', positionFromAnchor)
    return () => window.removeEventListener('resize', positionFromAnchor)
  }, [active, anchorRef, dialogRef])
}
