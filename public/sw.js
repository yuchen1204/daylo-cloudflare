const CACHE_NAME = 'daylo-v7';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (!event.request.url.startsWith(self.location.origin)) return;

  const url = new URL(event.request.url);

  // Don't cache API requests
  if (url.pathname.startsWith('/api/')) return;

  // Don't cache hashed assets (Vite handles cache busting via filenames)
  if (url.pathname.match(/\.[a-zA-Z0-9-]{8,}\.(js|css)$/)) return;

  event.respondWith(
    (async () => {
      const cachedResponse = await caches.match(event.request);
      if (cachedResponse) {
        return cachedResponse;
      }

      try {
        const response = await fetch(event.request);

        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      } catch (error) {
        console.error('Fetch failed:', error);
        throw error;
      }
    })()
  );
});
