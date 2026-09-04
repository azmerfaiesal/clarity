import { beforeEach, describe, expect, it, vi } from 'vitest'

const boundary = vi.hoisted(() => {
  const listener = { remove: vi.fn().mockResolvedValue(undefined) }
  let appUrlListener: ((event: { url: string }) => void) | undefined

  return {
    appAddListener: vi.fn(async (_event: string, handler: (event: { url: string }) => void) => {
      appUrlListener = handler
      return listener
    }),
    appGetLaunchUrl: vi.fn(),
    appUrlListener: () => appUrlListener,
    browserClose: vi.fn().mockResolvedValue(undefined),
    browserOpen: vi.fn().mockResolvedValue(undefined),
    listener,
  }
})

async function loadAuthBrowser(native: boolean) {
  vi.resetModules()
  vi.doMock('@capacitor/app', () => ({
    App: {
      addListener: boundary.appAddListener,
      getLaunchUrl: boundary.appGetLaunchUrl,
    },
  }))
  vi.doMock('@capacitor/browser', () => ({
    Browser: {
      close: boundary.browserClose,
      open: boundary.browserOpen,
    },
  }))
  vi.doMock('./platform', () => ({ isNativeApp: native }))
  return import('./authBrowser')
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('native authentication browser boundary', () => {
  it('opens the secure native browser for a native launch', async () => {
    const { launchAuthUrl } = await loadAuthBrowser(true)

    await launchAuthUrl('https://accounts.google.com/example', true)

    expect(boundary.browserOpen).toHaveBeenCalledWith({ url: 'https://accounts.google.com/example' })
  })

  it('navigates the web page without calling native plugins', async () => {
    const { launchAuthUrl } = await loadAuthBrowser(false)
    const navigate = vi.fn()

    await launchAuthUrl('https://accounts.google.com/example', false, navigate)

    expect(navigate).toHaveBeenCalledWith('https://accounts.google.com/example')
    expect(boundary.browserOpen).not.toHaveBeenCalled()
  })

  it('closes the secure browser only on native platforms', async () => {
    const native = await loadAuthBrowser(true)
    await native.closeNativeAuthBrowser()
    expect(boundary.browserClose).toHaveBeenCalledTimes(1)

    vi.clearAllMocks()
    const web = await loadAuthBrowser(false)
    await web.closeNativeAuthBrowser()
    expect(boundary.browserClose).not.toHaveBeenCalled()
  })

  it('returns the launch callback only on native platforms', async () => {
    boundary.appGetLaunchUrl.mockResolvedValue({
      url: 'com.azmerfaiesal.clarity://auth/callback?code=once',
    })
    const native = await loadAuthBrowser(true)
    expect(await native.getNativeLaunchUrl()).toBe('com.azmerfaiesal.clarity://auth/callback?code=once')

    vi.clearAllMocks()
    const web = await loadAuthBrowser(false)
    expect(await web.getNativeLaunchUrl()).toBeNull()
    expect(boundary.appGetLaunchUrl).not.toHaveBeenCalled()
  })

  it('returns null when Capacitor has no native launch URL', async () => {
    boundary.appGetLaunchUrl.mockResolvedValue(undefined)
    const native = await loadAuthBrowser(true)

    expect(await native.getNativeLaunchUrl()).toBeNull()
  })

  it('forwards native URL events and registers no listener on web', async () => {
    const handler = vi.fn()
    const native = await loadAuthBrowser(true)

    expect(await native.listenForNativeAuthUrls(handler)).toBe(boundary.listener)
    boundary.appUrlListener()?.({ url: 'com.azmerfaiesal.clarity://auth/callback?code=twice' })
    expect(handler).toHaveBeenCalledWith('com.azmerfaiesal.clarity://auth/callback?code=twice')

    vi.clearAllMocks()
    const web = await loadAuthBrowser(false)
    expect(await web.listenForNativeAuthUrls(handler)).toBeNull()
    expect(boundary.appAddListener).not.toHaveBeenCalled()
  })
})
