import { describe, expect, it } from 'vitest'
import {
  canStartDrawerDrag,
  createDrawerFrameScheduler,
  dragDirection,
  drawerMotion,
  drawerProgress,
  drawerReleaseVelocity,
  drawerSettleDuration,
  mobileDrawerWidth,
  shouldOpenDrawer,
} from './mobileDrawer'

describe('mobile drawer motion', () => {
  it('moves the drawer and the complete page by the same drag progress', () => {
    const progress = drawerProgress(0, 96, 320)

    expect(progress).toBe(0.3)
    expect(drawerMotion(progress, 320)).toEqual({
      drawerX: -224,
      pageX: 96,
      pageRadius: 7.2,
      pageScale: 0.9925,
      scrimOpacity: 0.3,
    })
  })

  it('coalesces pointer updates into one compositor write per animation frame', () => {
    const callbacks: FrameRequestCallback[] = []
    const writes: ReturnType<typeof drawerMotion>[] = []
    const scheduler = createDrawerFrameScheduler({
      requestFrame: (callback) => {
        callbacks.push(callback)
        return callbacks.length
      },
      cancelFrame: () => undefined,
      write: (motion) => writes.push(motion),
    })

    scheduler.schedule(0.1, 320)
    scheduler.schedule(0.2, 320)
    scheduler.schedule(0.5, 320)

    expect(callbacks).toHaveLength(1)
    expect(writes).toHaveLength(0)

    callbacks[0](16)

    expect(writes).toEqual([
      {
        drawerX: -160,
        pageX: 160,
        pageRadius: 12,
        pageScale: 0.9875,
        scrimOpacity: 0.5,
      },
    ])
  })

  it('settles a fast fling sooner than a slow release over the same distance', () => {
    expect(drawerSettleDuration(0.4, 1, 0, 320)).toBe(252)
    expect(drawerSettleDuration(0.4, 1, 1.2, 320)).toBe(170)
  })

  it('keeps the last swipe speed when the finger lifts without another move', () => {
    expect(drawerReleaseVelocity(0.8, 0, 16)).toBe(0.8)
    expect(drawerReleaseVelocity(0.8, 0, 80)).toBe(0)
    expect(drawerReleaseVelocity(0.8, -2, 4)).toBe(-0.5)
  })

  it('clamps drag progress at both ends', () => {
    expect(drawerProgress(0, -40, 320)).toBe(0)
    expect(drawerProgress(1, 80, 320)).toBe(1)
  })

  it('settles by distance unless a deliberate fling chooses the direction', () => {
    expect(shouldOpenDrawer(0.5, 0)).toBe(true)
    expect(shouldOpenDrawer(0.3, 0)).toBe(false)
    expect(shouldOpenDrawer(0.2, 0.6)).toBe(true)
    expect(shouldOpenDrawer(0.8, -0.6)).toBe(false)
  })

  it('waits for intent and leaves vertical scrolling alone', () => {
    expect(dragDirection(4, 3)).toBe('pending')
    expect(dragDirection(20, 5)).toBe('horizontal')
    expect(dragDirection(5, 20)).toBe('vertical')
  })

  it('allows an open drawer to be swiped from a navigation control', () => {
    expect(canStartDrawerDrag({ progress: 1, startX: 220, interactiveTarget: true })).toBe(true)
    expect(canStartDrawerDrag({ progress: 0, startX: 220, interactiveTarget: true })).toBe(false)
  })

  it('uses the same responsive width as the mobile sidebar', () => {
    expect(mobileDrawerWidth(320)).toBe(275.2)
    expect(mobileDrawerWidth(390)).toBe(320)
  })
})
