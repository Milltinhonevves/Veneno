// Versão 3 - sem cache agressivo
const CACHE_NAME = 'veneno-v3';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

// Sem cache - sempre busca do servidor
self.addEventListener('fetch', event => {
  event.respondWith(fetch(event.request));
});
