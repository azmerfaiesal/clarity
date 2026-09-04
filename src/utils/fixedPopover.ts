export type ViewportRect = {
  offsetLeft: number
  offsetTop: number
  width: number
  height: number
}

export type SafeAreaInsets = {
  top: number
  right: number
  bottom: number
  left: number
}

export type SafeViewportBounds = {
  left: number
  top: number
  right: number
  bottom: number
}

const DEFAULT_MARGIN = 8

export function safeViewportBounds(
  viewport: ViewportRect,
  insets: SafeAreaInsets,
  margin = DEFAULT_MARGIN,
): SafeViewportBounds {
  return {
    left: viewport.offsetLeft + insets.left + margin,
    top: viewport.offsetTop + insets.top + margin,
    right: viewport.offsetLeft + viewport.width - insets.right - margin,
    bottom: viewport.offsetTop + viewport.height - insets.bottom - margin,
  }
}

function cssPixels(styles: CSSStyleDeclaration, name: string): number {
  const value = Number.parseFloat(styles.getPropertyValue(name))
  return Number.isFinite(value) ? value : 0
}

export function getSafeViewportBounds(): SafeViewportBounds {
  const visual = window.visualViewport
  const viewport: ViewportRect = visual
    ? {
        offsetLeft: visual.offsetLeft,
        offsetTop: visual.offsetTop,
        width: visual.width,
        height: visual.height,
      }
    : { offsetLeft: 0, offsetTop: 0, width: window.innerWidth, height: window.innerHeight }
  const styles = getComputedStyle(document.documentElement)

  return safeViewportBounds(viewport, {
    top: cssPixels(styles, '--safe-area-inset-top'),
    right: cssPixels(styles, '--safe-area-inset-right'),
    bottom: cssPixels(styles, '--safe-area-inset-bottom'),
    left: cssPixels(styles, '--safe-area-inset-left'),
  })
}

export function clampFixedCoordinate(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(minimum, value), Math.max(minimum, maximum))
}

export function placeFixedPopover({
  anchor,
  size,
  bounds,
}: {
  anchor: { x: number; y: number }
  size: { width: number; height: number }
  bounds: SafeViewportBounds
}): { left: number; top: number; above: boolean } {
  const aboveTop = anchor.y - size.height - 10
  const above = aboveTop >= bounds.top
  const desiredTop = above ? aboveTop : anchor.y + 18

  return {
    left: clampFixedCoordinate(
      anchor.x - size.width / 2,
      bounds.left,
      bounds.right - size.width,
    ),
    top: clampFixedCoordinate(desiredTop, bounds.top, bounds.bottom - size.height),
    above,
  }
}
