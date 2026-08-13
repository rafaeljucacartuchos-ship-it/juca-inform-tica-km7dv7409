const CACHE_NAME = 'atm-shell-v2'
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-maskable.svg',
]

const ICON_PNG_MAP = {
  '/icon-192.png': { svg: '/icon.svg', size: 192 },
  '/icon-512.png': { svg: '/icon.svg', size: 512 },
  '/icon-192-maskable.png': { svg: '/icon-maskable.svg', size: 192 },
  '/icon-512-maskable.png': { svg: '/icon-maskable.svg', size: 512 },
}

async function generatePngIcon(svgUrl, size) {
  const response = await fetch(svgUrl)
  const blob = await response.blob()
  const bitmap = await createImageBitmap(blob)
  const canvas = new OffscreenCanvas(size, size)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bitmap, 0, 0, size, size)
  bitmap.close()
  return canvas.convertToBlob({ type: 'image/png' })
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
      ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  if (url.origin !== self.location.origin) return
  if (event.request.method !== 'GET') return

  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('/index.html')))
    return
  }

  var iconConfig = ICON_PNG_MAP[url.pathname]
  if (iconConfig) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached
        return generatePngIcon(iconConfig.svg, iconConfig.size)
          .then((blob) => {
            var response = new Response(blob, {
              headers: { 'Content-Type': 'image/png', 'Cache-Control': 'max-age=31536000' },
            })
            var clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
            return response
          })
          .catch(() => {
            return fetch(iconConfig.svg).then((r) => r)
          })
      }),
    )
    return
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached
      return fetch(event.request)
        .then((response) => {
          if (response.ok && response.type === 'basic') {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          }
          return response
        })
        .catch(() => cached)
    }),
  )
})
