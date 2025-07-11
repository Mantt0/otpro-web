
const CACHE_NAME = "otpro-cache-v1";
const URLS = [
  "/",
  "index.html",
  "style.css",
  "main.js",
  "manifest.json",
  "logo-sigma.png"
];
self.addEventListener("install", e=>{
  e.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(URLS)));
});
self.addEventListener("fetch", e=>{
  e.respondWith(
    caches.match(e.request).then(resp=>resp || fetch(e.request).then(r=>{
      const respClone = r.clone();
      caches.open(CACHE_NAME).then(cache=>{ cache.put(e.request, respClone); });
      return r;
    }))
  );
});
