const OPEN_THRESHOLD = 0.42
const FLING_VELOCITY = 0.45
const DRAG_SLOP = 8
const DRAWER_VIEWPORT_RATIO = 0.86
const DRAWER_MAX_WIDTH = 320
const EDGE_GESTURE_WIDTH = 24
const OPEN_PAGE_SCALE = 0.975
const OPEN_PAGE_RADIUS = 24

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function roundMotionValue(value: number): number {
  return Math.round(value * 10_000) / 10_000
}

export function drawerProgress(startProgress: number, deltaX: number, drawerWidth: number): number {
  if (drawerWidth <= 0) return clamp(startProgress, 0, 1)
  return clamp(startProgress + deltaX / drawerWidth, 0, 1)
}

export function mobileDrawerWidth(viewportWidth: number): number {
  return Math.min(viewportWidth * DRAWER_VIEWPORT_RATIO, DRAWER_MAX_WIDTH)
}

export function dragDirection(deltaX: number, deltaY: number): 'pending' | 'horizontal' | 'vertical' {
  if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < DRAG_SLOP) return 'pending'
  return Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical'
}

export function canStartDrawerDrag({
  progress,
  startX,
  interactiveTarget,
}: {
  progress: number
  startX: number
  interactiveTarget: boolean
}): boolean {
  if (progress > 0) return true
  return startX <= EDGE_GESTURE_WIDTH && !interactiveTarget
}

export type DrawerMotion = {
  drawerX: number
  pageX: number
  pageRadius: number
  pageScale: number
  scrimOpacity: number
}

export function drawerMotion(progress: number, drawerWidth: number): DrawerMotion {
  const settledProgress = clamp(progress, 0, 1)

  return {
    drawerX: drawerWidth * (settledProgress - 1),
    pageX: drawerWidth * settledProgress,
    pageRadius: roundMotionValue(OPEN_PAGE_RADIUS * settledProgress),
    pageScale: roundMotionValue(1 - (1 - OPEN_PAGE_SCALE) * settledProgress),
    scrimOpacity: settledProgress,
  }
}

export function drawerSettleDuration(
  progress: number,
  targetProgress: number,
  velocityX: number,
  drawerWidth: number,
): number {
  const progressDistance = Math.abs(targetProgress - progress)
  const distancePx = progressDistance * drawerWidth
  if (distancePx < 1) return 0

  const speed = Math.abs(velocityX)
  if (speed >= 0.05) return Math.round(clamp((distancePx / speed) * 0.55, 170, 320))
  return Math.round(clamp(180 + progressDistance * 120, 180, 300))
}

export function drawerReleaseVelocity(
  lastVelocityX: number,
  releaseDeltaX: number,
  elapsedMs: number,
): number {
  if (elapsedMs > 48) return 0
  if (elapsedMs > 0 && releaseDeltaX !== 0) return releaseDeltaX / elapsedMs
  return lastVelocityX
}

type DrawerFrameSchedulerOptions = {
  requestFrame: (callback: FrameRequestCallback) => number
  cancelFrame: (handle: number) => void
  write: (motion: DrawerMotion) => void
}

/**
 * Keeps high-frequency pointer events off React's render path. Pointer events
 * may arrive faster than the display can paint, so only the newest position is
 * written during the next animation frame.
 */
export function createDrawerFrameScheduler({
  requestFrame,
  cancelFrame,
  write,
}: DrawerFrameSchedulerOptions) {
  let frameHandle: number | null = null
  let pending: { progress: number; drawerWidth: number } | null = null

  const schedule = (progress: number, drawerWidth: number) => {
    pending = { progress, drawerWidth }
    if (frameHandle !== null) return
    frameHandle = requestFrame(() => {
      frameHandle = null
      const next = pending
      pending = null
      if (next) write(drawerMotion(next.progress, next.drawerWidth))
    })
  }

  const flush = (progress: number, drawerWidth: number) => {
    if (frameHandle !== null) cancelFrame(frameHandle)
    frameHandle = null
    pending = null
    write(drawerMotion(progress, drawerWidth))
  }

  const cancel = () => {
    if (frameHandle !== null) cancelFrame(frameHandle)
    frameHandle = null
    pending = null
  }

  return { schedule, flush, cancel }
}

export function shouldOpenDrawer(progress: number, velocityX: number): boolean {
  if (Math.abs(velocityX) >= FLING_VELOCITY) return velocityX > 0
  return progress >= OPEN_THRESHOLD
}
