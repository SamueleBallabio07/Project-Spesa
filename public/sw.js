const CACHE_NAME = 'spesa-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Install: cache degli asset statici
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Attivazione: pulizia cache vecchie
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch: strategia cache-first per asset statici, network-first per API
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Solo richieste GET
  if (request.method !== 'GET') return;

  // API Supabase: network-first con fallback cache
  if (request.url.includes('supabase.co')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(request);
        })
    );
    return;
  }

  // Asset statici: cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      return cached || fetch(request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, clone);
        });
        return response;
      });
    })
  );
});

// Sincronizzazione background
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    event.waitUntil(syncPendingData());
  }
});

async function syncPendingData() {
  // La sincronizzazione è gestita lato client con Supabase
  // Questo è un placeholder per future implementazioni
  console.log('Background sync triggered');
}

// Notifiche push (future implementazioni)
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Project Spesa';
  const options = {
    body: data.body || 'Hai nuovi aggiornamenti',
    icon: '/icon-192.png',
    badge: '/icon-192.png'
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
