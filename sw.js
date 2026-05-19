const CACHE_NAME = "nbody-pwa-v16";
const EXTERNAL_CACHE = "nbody-external-v3";

const ASSETS = [
  "./",
  "./index.html",
  "./main.js",
  "./manifest.webmanifest",
  "./sw.js",
  "./png/icon-192.png",
  "./png/icon-512.png",
  "./rust-engine/pkg/rust_engine.js",
  "./results.html",
  "./results.js",
  "./supabaseClient.js",
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
          if (key !== CACHE_NAME && key !== EXTERNAL_CACHE) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
    return;
  }

  if (url.hostname === "cdn.jsdelivr.net") {
    event.respondWith(
      caches.open(EXTERNAL_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;

        const response = await fetch(event.request);
        cache.put(event.request, response.clone());
        return response;
      })
    );
  }
});
