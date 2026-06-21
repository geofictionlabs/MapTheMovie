import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'

// Workbox injects the precache manifest here at build time
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return
  const url = new URL(e.request.url)

  // Network-first for HTML navigation
  if (e.request.mode === 'navigate' || url.pathname.endsWith('.html')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)))
    return
  }

  // Cache-first for hashed assets
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.open('mtm-assets-v4').then(cache =>
        cache.match(e.request).then(cached => {
          if (cached) return cached
          return fetch(e.request).then(res => { cache.put(e.request, res.clone()); return res })
        })
      )
    )
    return
  }

  // NetworkFirst for Supabase API calls
  if (url.hostname.includes('supabase.co')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)))
    return
  }
})

self.addEventListener('push', e => {
  if (!e.data) return
  let payload
  try { payload = e.data.json() }
  catch { payload = { title: 'MapTheMovie', body: e.data.text() } }
  e.waitUntil(
    self.registration.showNotification(payload.title || 'MapTheMovie', {
      body:    payload.body  || '',
      icon:    payload.icon  || '/icons/icon-192.png',
      badge:   '/icons/icon-192.png',
      data:    payload.data  || {},
      vibrate: [200, 100, 200],
    })
  )
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = (e.notification.data && e.notification.data.url) || '/'
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
      const existing = cs.find(c => c.url.includes(self.location.origin))
      if (existing) return existing.focus()
      return clients.openWindow(url)
    })
  )
})
