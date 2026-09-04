import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import type { PluginListenerHandle } from '@capacitor/core'
import { isNativeApp } from './platform'

export async function launchAuthUrl(
  url: string,
  native = isNativeApp,
  navigate: (next: string) => void = (next) => window.location.assign(next),
): Promise<void> {
  if (native) return openNativeAuthBrowser(url)
  navigate(url)
}

export async function openNativeAuthBrowser(url: string): Promise<void> {
  if (isNativeApp) await Browser.open({ url })
}

export async function closeNativeAuthBrowser(): Promise<void> {
  if (isNativeApp) await Browser.close().catch(() => undefined)
}

export async function getNativeLaunchUrl(): Promise<string | null> {
  if (!isNativeApp) return null
  return (await App.getLaunchUrl())?.url ?? null
}

export async function listenForNativeAuthUrls(
  handler: (url: string) => void | Promise<void>,
): Promise<PluginListenerHandle | null> {
  if (!isNativeApp) return null
  return App.addListener('appUrlOpen', ({ url }) => void handler(url))
}
