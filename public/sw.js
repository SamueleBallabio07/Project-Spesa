const CACHE_NAME = 'spesa-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

// Il catalogo alimentare e' un file statico: lo mettiamo in cache al primo
// utilizzo, non all'installazione, cosi' l'installazione resta veloce.
const CATALOG = '/catalog.json';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Navigazioni: network-first, fallback su index.html cacheata (app offline).
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', clone));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // API Supabase: network-first con cache di riserva.
  if (url.hostname.endsWith('supabase.co')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Catalogo: cache-first con rivalidazione in background.
  // Alla prima visita scarica ~240KB; poi e' istantaneo e funziona offline,
  // mentre un catalogo aggiornato arriva al caricamento successivo.
  if (url.pathname === CATALOG) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(CATALOG).then((cached) => {
          const revalidate = fetch(request)
            .then((response) => {
              if (response.ok) cache.put(CATALOG, response.clone());
              return response;
            })
            .catch(() => cached);

          return cached || revalidate;
        })
      )
    );
    return;
  }

  // Altro: cache-first.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
    )
  );
});
