const CACHE_NAME = "flood-fill-cache-v1.20250607";
const urlsToCache = [
  "./",
  "./index.html",
  "./flood_fill_levels.json",
  "./peaceful-piano-background-music-218762.mp3",
  "./ui-pop-sound-316482.mp3",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    ).then(() => self.clients.claim()) // 掌控所有分頁
  );
});
