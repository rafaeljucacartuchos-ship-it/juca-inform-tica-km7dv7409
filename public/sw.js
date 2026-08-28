/*
 * Service worker for JUCA Informática (manual implementation).
 *
 * The production build (when VitePWA can be wired into vite.config.ts) will
 * replace this with a Workbox-generated SW. Until then this file provides:
 *   - precache of the app shell
 *   - Direct network access for PocketBase API calls (/api/*)
 *   - NetworkFirst for JS/CSS assets (sempre busca a versão nova com internet)
 *   - CacheFirst for static image/font assets
 *   - network-first navigation fallback to /index.html
 *
 * Served from /public so /sw.js is available in dev and preview.
 */

// BUILD: __TIMESTAMP__

const APP_SHELL_CACHE = 'juca-app-shell-v1'
const API_CACHE = 'juca-api-v1'
const ASSET_CACHE = 'juca-assets-v1'

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-maskable.svg',
]

const ASSET_EXTENSIONS = /\.(?:png|jpe?g|gif|webp|avif|ico|svg|woff2?|ttf|eot|css|js)$/

// --- Install: precache the app shell ----------------------------------------
self.addEventListener('install', (event) => {
  // NOTA: não chamamos self.skipWaiting() aqui. O novo SW deve entrar no
  // estado "waiting" naturalmente, para que o hook usePwaUpdate consiga
  // detectá-lo e exibir o banner de atualização. A ativação imediata só
  // acontece quando o usuário clica no banner, que envia
  // postMessage({ type: 'SKIP_WAITING' }) — tratado no listener de message.
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch(() => undefined)),
  )
})

// --- Activate: clean old caches ---------------------------------------------
self.addEventListener('activate', (event) => {
  const keep = new Set([APP_SHELL_CACHE, API_CACHE, ASSET_CACHE])
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !keep.has(key)).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  )
})

// --- Helpers ----------------------------------------------------------------
async function networkFirst(request, cacheName, timeoutMs = 10000) {
  const cache = await caches.open(cacheName)
  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs))
  try {
    const network = await Promise.race([fetch(request), timeout])
    if (network) {
      cache.put(request, network.clone()).catch(() => {})
      return network
    }
    throw new Error('network timeout')
  } catch {
    const cached = await cache.match(request)
    if (cached) return cached
    throw new Error('no cached response')
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response && response.status === 200) {
    cache.put(request, response.clone()).catch(() => {})
  }
  return response
}

// --- Fetch ------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Não intercepta mutações (POST/PUT/DELETE/PATCH/etc.): deixa o navegador
  // enviar diretamente pela rede sem passar por event.respondWith(fetch(request)).
  // No Safari (iOS/Mac), refazer fetch() em requisições de mutação com multipart
  // corrompe o FormData/corpo de upload, causando erro 400 no PocketBase.
  // O suporte offline de mutações é tratado na camada da aplicação (offlinePb).
  if (request.method !== 'GET') return

  // Requisições para /api/* (PocketBase) vão direto pela rede sem passar pelo SW.
  // No iOS, buscas e consultas podiam passar do timeout de 10s do networkFirst e
  // retornar cache vazio. Mutações e consultas agora vão direto ao servidor.
  if (url.pathname.startsWith('/api/')) return

  // NetworkFirst for static assets (images, fonts, css, js) — garante que o
  // app sempre busque a versão nova quando há internet, em vez de servir o
  // cache antigo para sempre. Com CacheFirst os técnicos ficavam presos na
  // versão antiga dos JS/CSS indefinidamente.
  if (ASSET_EXTENSIONS.test(url.pathname)) {
    event.respondWith(networkFirst(request, ASSET_CACHE).catch(() => fetch(request)))
    return
  }

  // Network-first for navigations, fallback to cached index.html (offline SPA).
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          caches.open(APP_SHELL_CACHE).then((cache) => cache.put('/index.html', response.clone()))
          return response
        })
        .catch(() => caches.match('/index.html').then((r) => r || caches.match('/'))),
    )
    return
  }

  // Same-origin GET: stale-while-revalidate.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.open(APP_SHELL_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          const fetchPromise = fetch(request)
            .then((response) => {
              if (response && response.status === 200) {
                cache.put(request, response.clone()).catch(() => {})
              }
              return response
            })
            .catch(() => cached)
          return cached || fetchPromise
        }),
      ),
    )
  }
})

// --- Message: SKIP_WAITING ---------------------------------------------------
// Permite que a página peça ao SW waiting que assuma o controle imediatamente,
// para então recarregar com a versão nova.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// --- Push notifications ------------------------------------------------------
// Recebe a payload JSON enviada pelo servidor (title, body, icon, url, tag) e
// exibe uma notificação nativa. Funciona mesmo com o app fechado — essa é a
// principal vantagem sobre notificações in-app.
self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch (e) {
    try {
      payload = event.data ? { body: event.data.text() } : {}
    } catch (e2) {
      payload = {}
    }
  }

  const title = payload.title || 'JUCA Informática'
  const tag = payload.tag || 'juca-os'
  const targetUrl = payload.url || '/'

  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icon-maskable.svg',
    badge: '/icon.svg',
    tag: tag,
    // renotify mantém o contador de notificações da mesma tag; data leva a URL
    // para o handler de clique saber qual OS abrir.
    renotify: true,
    data: {
      url: targetUrl,
      tag: tag,
    },
    // Vibração no Android: [vibra, pausa, vibra].
    vibrate: [200, 100, 200],
    requireInteraction: false,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// --- Notification click: abre/foca o app na OS específica --------------------
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const data = event.notification.data || {}
  const targetUrl = data.url || '/'

  // Garante URL absoluta relativa à origem do SW.
  const fullPath = new URL(targetUrl, self.location.origin).href

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })

      // Procura uma aba/janela já aberta no mesmo app.
      for (const client of allClients) {
        const clientUrl = new URL(client.url, self.location.origin)
        // Mesma origem: foca e navega para a OS.
        if (clientUrl.origin === self.location.origin) {
          if ('focus' in client) {
            try {
              await client.focus()
            } catch (e) {}
          }
          if ('navigate' in client) {
            try {
              await client.navigate(fullPath)
            } catch (e) {}
          }
          return
        }
      }

      // Nenhuma janela aberta: abre uma nova.
      if (self.clients.openWindow) {
        try {
          await self.clients.openWindow(fullPath)
        } catch (e) {}
      }
    })(),
  )
})
