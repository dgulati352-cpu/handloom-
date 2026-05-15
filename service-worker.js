const CACHE_NAME = 'hridyang-cache-v8';



// Only cache static assets — NOT JS files (so updates always load fresh)
const PRECACHE_URLS = [
  './',
  './index.html',
  './handloom.html',
  './god-clothes.html',
  './fancy-articles.html',
  './checkout.html',
  './product.html',
  './style.css',
  './manifest.json',
];

// ─── Install ─────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
  );
});

// ─── Activate: wipe ALL old caches ───────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ─── Fetch strategy ──────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || !url.protocol.startsWith('http')) return;

  // Always network-first for JS, Firebase, and API
  const isJS = url.pathname.endsWith('.js');
  const isFirebase =
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('firebaseapp') ||
    url.pathname.startsWith('/api/');

  if (isJS || isFirebase) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // Cache-first for HTML, CSS, images
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        return response;
      }).catch(() => {
        if (request.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});
