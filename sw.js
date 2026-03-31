const CACHE_NAME = "nbody-pwa-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./main.js",
  "./manifest.webmanifest",
  "./sw.js",
  "./png/icon-192.png",
  "./png/icon-512.png",
  "./rust-engine/pkg/rust_engine.js",
  "./rust-engine/pkg/rust_engine_bg.wasm"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});