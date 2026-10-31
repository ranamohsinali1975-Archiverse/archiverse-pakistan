/* Archiverse-Pakistan — service worker.
   Caches the app shell and content so articles can be read offline.
   Bump CACHE_VERSION whenever you publish a new build. */

const CACHE_VERSION = "archiverse-app-v1.0.0";
const SHELL = [
  "./",
  "./index.html",
  "./config.js",
  "./manifest.webmanifest",
  "./assets/style.css",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/logo-white.png",
  "./assets/logo-black.png",
  "./assets/mark-512.png",
  "./assets/favicon.png",
  "./js/app.js",
  "./js/ui.js",
  "./js/data.js",
  "./js/demo-data.js",
  "./js/content.js",
  "./js/views-content.js",
  "./js/views-debates.js",
  "./js/views-account.js",
  "./js/views-institutions.js",
  "./content/articles.json",
  "./content/videos.json",
  "./content/roadmap.json",
  "./content/survey-results.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Never cache the database or auth traffic.
  if (url.hostname.endsWith(".supabase.co") || url.hostname.endsWith(".supabase.in")) return;

  // YouTube players and thumbnails: network only.
  if (url.hostname.includes("youtube") || url.hostname.includes("ytimg")) return;

  // Fonts and the Supabase library from CDNs: cache after first use.
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com" || url.hostname === "cdn.jsdelivr.net") {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // Our own files: network first (so updates arrive), cached copy when offline.
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(req));
  }
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch (err) {
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;
    if (req.mode === "navigate") {
      const shell = await cache.match("./index.html");
      if (shell) return shell;
    }
    throw err;
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(req);
  const network = fetch(req).then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
  return cached || (await network) || Response.error();
}
