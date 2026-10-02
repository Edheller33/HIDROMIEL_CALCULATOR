/* =========================================================================
   Service Worker — Calculadora de Hidromiel (offline-first)
   Súbelo a GitHub Pages junto a index.html (misma carpeta).
   Para forzar un aviso de actualización: cambia VERSION.
   ========================================================================= */
const VERSION = "v1.0.0";
const CACHE = "hidromiel-" + VERSION;
const CORE = ["./", "./index.html"];

// Instalación: precachea el HTML principal (sin skipWaiting: el usuario decide cuándo actualizar)
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)));
});

// Activación: elimina cachés antiguas y toma control de las pestañas abiertas
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("hidromiel-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// La página pide activar la versión nueva
self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});

// Estrategia: caché primero + revalidación en segundo plano (stale-while-revalidate)
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(handle(e, req));
});

async function handle(event, req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req, { ignoreSearch: true });

  const network = fetch(req).then(async (res) => {
    if (res && res.ok) {
      await cache.put(req, res.clone());
      if (cached && changed(cached, res)) notify();   // contenido distinto al cacheado
    }
    return res;
  }).catch(() => null);

  if (cached) { event.waitUntil(network); return cached; }

  const res = await network;
  if (res) return res;
  if (req.mode === "navigate") return (await cache.match("./index.html")) || Response.error();
  return Response.error();
}

// Compara ETag / Last-Modified (GitHub Pages los envía)
function changed(a, b) {
  const ea = a.headers.get("etag"), eb = b.headers.get("etag");
  if (ea && eb) return ea !== eb;
  const la = a.headers.get("last-modified"), lb = b.headers.get("last-modified");
  return !!(la && lb && la !== lb);
}

async function notify() {
  const all = await self.clients.matchAll({ includeUncontrolled: true });
  all.forEach((c) => c.postMessage({ type: "CONTENT_UPDATED" }));
}
