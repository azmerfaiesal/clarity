import { describe, expect, it } from 'vitest'
import { placeFixedPopover, safeViewportBounds } from './fixedPopover'

describe('safe-area fixed popover placement', () => {
  it('keeps a portrait popover below the status area and above the home indicator', () => {
    const bounds = safeViewportBounds(
      { offsetLeft: 0, offsetTop: 0, width: 393, height: 852 },
      { top: 59, right: 0, bottom: 34, left: 0 },
      8,
    )

    expect(bounds).toEqual({ left: 8, top: 67, right: 385, bottom: 810 })
    expect(
      placeFixedPopover({ anchor: { x: 196, y: 70 }, size: { width: 240, height: 180 }, bounds }),
    ).toEqual({ left: 76, top: 88, above: false })
  })

  it('keeps a landscape-left popover clear of the notch on the left', () => {
    const bounds = safeViewportBounds(
      { offsetLeft: 0, offsetTop: 0, width: 852, height: 393 },
      { top: 0, right: 0, bottom: 21, left: 59 },
      8,
    )

    expect(bounds).toEqual({ left: 67, top: 8, right: 844, bottom: 364 })
    expect(
      placeFixedPopover({ anchor: { x: 30, y: 250 }, size: { width: 256, height: 180 }, bounds }),
    ).toEqual({ left: 67, top: 60, above: true })
  })

  it('keeps a landscape-right popover clear of the notch on the right', () => {
    const bounds = safeViewportBounds(
      { offsetLeft: 0, offsetTop: 0, width: 852, height: 393 },
      { top: 0, right: 59, bottom: 21, left: 0 },
      8,
    )

    expect(bounds).toEqual({ left: 8, top: 8, right: 785, bottom: 364 })
    expect(
      placeFixedPopover({ anchor: { x: 830, y: 250 }, size: { width: 256, height: 180 }, bounds }),
    ).toEqual({ left: 529, top: 60, above: true })
  })
})
