// School portal service worker. Deliberately cautious, like the portal itself: marks, fees and receipts must always be
// the live ones, so nothing private is ever stored on the device and nothing stale is ever shown in place of a fresh answer.
//
// It does two things: (1) makes the portal installable as an app, and (2) makes repeat visits faster by keeping the
// program files (content-hashed, they never change under the same name). When the phone has no signal it shows a plain
// "you are offline" page instead of the browser's error page.
//
// Never cached: anything under /api or /uploads (marks, fees, receipts, report cards, photographs), and anything that is
// not a plain GET (saving a mark, recording a payment). Those always go straight to the server.
//
// The word in capitals below is replaced with the time of the build (vite.config.ts), so every new version of the portal
// starts a fresh cache and the old one is thrown away.
const CACHE = 'portal-__BUILD_ID__';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add('/offline.html')));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) return;

  // Program files: the name changes whenever the content does, so what is stored can always be reused.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const stored = await cache.match(request);
        if (stored) return stored;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
    );
    return;
  }

  // A page: always ask the server; only when it cannot be reached show the offline page.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/offline.html')));
  }
});
