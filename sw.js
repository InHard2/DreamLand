/* DreamLand service worker: offline cache for the app shell. */
const CACHE = 'dreamland-v7';
const FILES = [
  './', './index.html', './manifest.webmanifest',
  './js/shared.js', './js/math.js', './js/textures.js', './js/font.js', './js/items.js', './js/storage.js',
  './js/world.js', './js/models.js', './js/entities.js', './js/renderer.js', './js/audio.js', './js/input.js',
  './js/gui.js', './js/game.js', './js/textures2.js', './js/items2.js', './js/structures.js', './js/models2.js',
  './js/mobs2.js', './js/dims.js', './js/net.js', './js/portalgun.js', './js/extras.js',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// network-first so updates arrive promptly, cache fallback for offline play
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
  );
});
