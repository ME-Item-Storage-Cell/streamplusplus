// stream++ service worker
// Bump CACHE_VERSION when you deploy updates to force a refresh
const CACHE_VERSION = 'stream++-v1';
const CACHE_NAME = CACHE_VERSION;

// Files to cache on install (app shell)
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  // Google Fonts — cached on first load, served offline after
  'https://fonts.googleapis.com/css2?family=Geist:wght@200;300;400;500;600;700&family=Geist+Mono:wght@300;400;500&display=swap',
];

// ── INSTALL: pre-cache app shell ──────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache what we can; ignore failures for external resources
      return Promise.allSettled(
        PRECACHE.map(url => cache.add(url).catch(() => {}))
      );
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: clean up old caches ─────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: serve from cache, fall back to network ─────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and Supabase API requests (always go to network for sync)
  if (request.method !== 'GET') return;
  if (url.hostname.includes('supabase.co')) return;

  // Network-first for navigation (ensures fresh HTML)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Cache-first for fonts and static assets
  if (
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com' ||
    request.destination === 'image' ||
    request.destination === 'style' ||
    request.destination === 'script'
  ) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        });
      })
    );
    return;
  }
});
