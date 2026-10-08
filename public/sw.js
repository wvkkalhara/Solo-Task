/* ------------------------------------------------------------------ */
/*  Solo Task service worker — offline-first app shell                 */
/*                                                                     */
/*  The production build is a single self-contained HTML file, so      */
/*  caching '/' + '/index.html' makes the whole app available          */
/*  offline. Static assets & Google Fonts use a network-first,         */
/*  cache-on-success strategy. Firebase traffic is ALWAYS network.     */
/* ------------------------------------------------------------------ */

const CACHE = "solotask-v1";
const CORE = ["/", "/index.html", "/manifest.webmanifest", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";

  // Firebase / sync traffic: network only, never cached
  if (!sameOrigin && !isFont) return;

  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        // SPA fallback: any document request resolves to the cached shell
        return cached || (request.destination === "document" ? caches.match("/index.html") : Response.error());
      })
  );
});
