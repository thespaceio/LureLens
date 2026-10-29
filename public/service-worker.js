// LureLens service worker: makes the game work offline from the first visit.
// The build (see precacheServiceWorker in vite.config.ts) replaces BUILD_ID and
// PRECACHE with the real build hash and the list of every built file, so the
// whole app, including the lazily loaded dashboard, is saved on install.
// Paths are relative so the app also works under a sub-path (GitHub Pages).
const BUILD_ID = /*__BUILD_ID__*/ 'dev';
const PRECACHE = /*__PRECACHE__*/ ['./', './index.html', './manifest.json'];
const CACHE_NAME = `lurelens-${BUILD_ID}`;
const FONT_CACHE = 'lurelens-fonts';
const FONT_ORIGINS = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE)));
  // No skipWaiting: an updated worker takes over once old tabs close, so a page
  // running the previous build never loses the files it still needs.
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(names => Promise.all(names.filter(n => n !== CACHE_NAME && n !== FONT_CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Web fonts: keep a copy so the brand typefaces also work offline.
  if (FONT_ORIGINS.includes(url.origin)) {
    event.respondWith(
      caches.open(FONT_CACHE).then(cache =>
        cache.match(request).then(
          cached =>
            cached ||
            fetch(request).then(response => {
              if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
              return response;
            })
        )
      )
    );
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Pages: network first so updates show up, cached copy when offline.
  // 'no-cache' asks the server whether the page changed instead of reusing the
  // browser's stored copy (GitHub Pages lets browsers keep it for 10 minutes),
  // so a new release shows on the next visit.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-cache' })
        .then(response => {
          // Only cache real pages, so an error page never replaces the offline copy.
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy));
          }
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Built assets, icons: cache first, then network.
  event.respondWith(
    caches.match(request).then(
      cached =>
        cached ||
        fetch(request).then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        })
    )
  );
});
