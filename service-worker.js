const CACHE_NAME = 'hridyang-cache-v3';

// Static assets to pre-cache at install time
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/handloom.html',
  '/god-clothes.html',
  '/fancy-articles.html',
  '/checkout.html',
  '/product.html',
  '/style.css',
  '/script-v12.js',
  '/firebase-config.js',
  '/constants.js',
  '/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Inter:wght@300;400;500;600;700&display=swap'
];

// ─── Install: pre-cache all static assets ───────────────────────────────────
self.addEventListener('install', event => {
  self.skipWaiting(); // Activate new SW immediately
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // addAll fails silently for non-critical cross-origin assets, so
      // split into two groups: critical (must succeed) and optional.
      const criticalUrls = [
        '/',
        '/index.html',
        '/handloom.html',
        '/god-clothes.html',
        '/fancy-articles.html',
        '/style.css',
        '/script-v12.js',
        '/firebase-config.js',
        '/constants.js',
        '/manifest.json',
      ];
      return cache.addAll(criticalUrls);
    })
  );
});

// ─── Activate: delete old caches ────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      )
    ).then(() => self.clients.claim()) // Take control of all open tabs
  );
});

// ─── Fetch: smart strategy based on request type ────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Skip non-GET requests and browser-extension requests
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) return;

  // 2. Network-first for Firebase, API calls (always want fresh data)
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('firebaseapp') ||
    url.pathname.startsWith('/api/')
  ) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // 3. Cache-first for everything else (HTML, CSS, JS, images)
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      return fetch(request).then(response => {
        // Only cache valid responses
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone));
        return response;
      }).catch(() => {
        // Offline fallback: return the homepage for navigation requests
        if (request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
