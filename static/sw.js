// Service worker v4 - auto-limpa cache e nunca cacheia JS
const CACHE_NAME = 'veneno-v4';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = event.request.url;
  // JS e HTML nunca vão pro cache — sempre busca do servidor
  if (url.endsWith('.js') || url.endsWith('.html') || url.includes('processar') || url.includes('download')) {
    event.respondWith(fetch(event.request));
    return;
  }
  // CSS e imagens podem cachear
  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(event.request).then(resp => resp || fetch(event.request).then(r => {
        cache.put(event.request, r.clone());
        return r;
      }))
    )
  );
});
