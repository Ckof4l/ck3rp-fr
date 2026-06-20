/* ============================================================================
   Service worker CK3FR RP — PWA installable.
   Stratégie sûre vis-à-vis des chunks périmés :
   - Navigations (index.html) : network-first → on a toujours le dernier HTML
     (donc les bons chunks), avec repli cache hors-ligne.
   - Assets hashés (/assets/) : cache-first (immutables).
   - Fonds / icônes (/bg/, /icons) : stale-while-revalidate.
   - Tout le cross-origin (Supabase, Google Fonts) n'est PAS intercepté.
   ========================================================================== */

const CACHE = 'ck3fr-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // Supabase, fonts… : on laisse passer.

  // Navigations : dernier HTML d'abord, repli cache si hors-ligne.
  if (req.mode === 'navigate') {
    e.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req)
          const c = await caches.open(CACHE)
          c.put('/', fresh.clone())
          return fresh
        } catch {
          return (await caches.match(req)) || (await caches.match('/')) || Response.error()
        }
      })(),
    )
    return
  }

  // Assets hashés : cache-first (le hash change à chaque build).
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      (async () => {
        const cached = await caches.match(req)
        if (cached) return cached
        const fresh = await fetch(req)
        const c = await caches.open(CACHE)
        c.put(req, fresh.clone())
        return fresh
      })(),
    )
    return
  }

  // Fonds & icônes : on sert le cache mais on rafraîchit en arrière-plan.
  if (url.pathname.startsWith('/bg/') || url.pathname.startsWith('/icons')) {
    e.respondWith(
      (async () => {
        const c = await caches.open(CACHE)
        const cached = await c.match(req)
        const fetching = fetch(req)
          .then((r) => {
            c.put(req, r.clone())
            return r
          })
          .catch(() => cached)
        return cached || fetching
      })(),
    )
    return
  }

  // Reste : réseau, repli cache.
  e.respondWith(fetch(req).catch(() => caches.match(req)))
})
