import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { Keyboard, KeyboardResize } from '@capacitor/keyboard'
import { StatusBar, Style } from '@capacitor/status-bar'

export const isNativeApp = Capacitor.isNativePlatform()

export type NativeFeedback = 'selection' | 'success' | 'warning'

type HapticRequest =
  | { channel: 'impact'; style: 'light' }
  | { channel: 'notification'; type: 'success' | 'warning' }

/** A platform-independent description keeps the feedback vocabulary testable. */
export function hapticRequest(kind: NativeFeedback): HapticRequest {
  switch (kind) {
    case 'selection':
      return { channel: 'impact', style: 'light' }
    case 'success':
      return { channel: 'notification', type: 'success' }
    case 'warning':
      return { channel: 'notification', type: 'warning' }
  }
}

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

/** Native feedback is best-effort: interaction mutations must never await it. */
export function nativeFeedback(kind: NativeFeedback): void {
  if (!isNativeApp) return

  const request = hapticRequest(kind)
  if (request.channel === 'impact') {
    void Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined)
    return
  }

  void Haptics.notification({
    type: request.type === 'success' ? NotificationType.Success : NotificationType.Warning,
  }).catch(() => undefined)
}

export function nativeSelectionHaptic(): void {
  nativeFeedback('selection')
}

export function nativeSuccessHaptic(): void {
  nativeFeedback('success')
}

export function nativeWarningHaptic(): void {
  nativeFeedback('warning')
}
