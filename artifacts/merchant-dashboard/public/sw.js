const CACHE_PREFIX = 'jatek-merchant-';
const CACHE_NAME = `${CACHE_PREFIX}v1`;

const appAsset = (path) => new URL(path, self.registration.scope).href;
const APP_SHELL = [
  appAsset('./'),
  appAsset('./index.html'),
  appAsset('./manifest.webmanifest'),
  appAsset('./jatek-logo.png'),
  appAsset('./icon-192.png'),
  appAsset('./favicon.png'),
  appAsset('./apple-touch-icon.png'),
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(appAsset('./'), copy));
          }
          return response;
        })
        .catch(async () => (
          (await caches.match(appAsset('./')))
          || (await caches.match(appAsset('./index.html')))
          || Response.error()
        )),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
      return cached || network;
    }),
  );
});