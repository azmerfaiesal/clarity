import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { Keyboard, KeyboardResize } from '@capacitor/keyboard'
import { StatusBar, Style } from '@capacitor/status-bar'

export const isNativeApp = Capacitor.isNativePlatform()

/**
 * WKWebView can retain a page zoom after a simulator pinch or debugger reload.
 * A native app should always reopen at the device width; Clarity's own text
 * size control remains available in Settings. Keep this native-only so the web
 * and PWA builds retain normal browser pinch zoom.
 */
function lockNativeViewport(): void {
  const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
  viewport?.setAttribute(
    'content',
    'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover',
  )
}

/** Prepare the WebView before React paints its first frame. */
export function initializeNativeApp(): void {
  if (!isNativeApp) return

  lockNativeViewport()
  document.documentElement.classList.add('native-app')
  document.documentElement.classList.add(`native-${Capacitor.getPlatform()}`)

  void Promise.allSettled([
    StatusBar.setOverlaysWebView({ overlay: true }),
    Keyboard.setResizeMode({ mode: KeyboardResize.Native }),
  ])
}

/** Capacitor names the styles for the background they suit, not the glyph colour. */
export function setNativeTheme(theme: 'light' | 'dark'): void {
  if (!isNativeApp) return
  void StatusBar.setStyle({ style: theme === 'dark' ? Style.Dark : Style.Light })
}

export function nativeSelectionHaptic(): void {
  if (!isNativeApp) return
  void Haptics.impact({ style: ImpactStyle.Light })
}

export function nativeSuccessHaptic(): void {
  if (!isNativeApp) return
  void Haptics.notification({ type: NotificationType.Success })
}
