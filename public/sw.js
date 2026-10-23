/* Service worker Zeta Download: syarat aplikasi bisa dipasang + halaman tetap terbuka saat offline.
   Permintaan /api/* tidak pernah disentuh (selalu langsung ke jaringan). */
const CACHE = 'zeta-v1'
const SHELL = ['/', '/css/site.css', '/app.js', '/favicon.ico', '/icons/icon-192.png']

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()).catch(() => self.skipWaiting()))
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return

  // Halaman: jaringan dulu, cadangan dari cache saat offline
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => { caches.open(CACHE).then(c => c.put('/', res.clone())); return res })
        .catch(() => caches.match('/').then(r => r || Response.error()))
    )
    return
  }

  // File statis: tampilkan cache, perbarui di belakang layar
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(req, res.clone()))
        return res
      }).catch(() => hit)
      return hit || net
    })
  )
})
