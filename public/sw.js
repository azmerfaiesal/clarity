/*
 * Clarity's service worker.
 *
 * It exists for one reason: notifications. On Android Chrome the `Notification`
 * constructor throws `Illegal constructor` outright, and an iOS home-screen web
 * app has no constructor at all — both platforms will only raise a notification
 * through `registration.showNotification()`. A registered worker is also what
 * makes iOS offer the permission prompt in the first place. So the page decides
 * *when* a reminder is due; this worker is how it gets shown.
 *
 * Deliberately no `fetch` handler. Caching the app here would mean a second
 * cache to invalidate on every deploy, and a stale one is how a static site
 * starts serving last week's bundle. Without a fetch listener the browser skips
 * the worker entirely for navigation and asset requests, exactly as before —
 * this adds a delivery channel and changes nothing about how the app loads.
 * The flip side, stated plainly: no offline start-up and no background wake, so
 * reminders still only fire while Clarity is running somewhere.
 */

self.addEventListener('install', () => {
  // No caches to warm, so there is nothing to wait for.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

/** Tapping a reminder should land on the app, not a second copy of it. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  event.waitUntil(
    (async () => {
      const scope = self.registration.scope
      const clients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      for (const client of clients) {
        if (!client.url.startsWith(scope)) continue
        if ('focus' in client) return client.focus()
      }
      return self.clients.openWindow(scope)
    })(),
  )
})
