/* Service worker : hors connexion. Les fichiers mis en cache restent chiffrés. */
const CACHE = 'ecc-equin-v7';
const SHELL = ['./','index.html','app.css','boot.js','app.enc','manifest.webmanifest','icons/icon-180.png','icons/icon-192.png','icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('ecc-equin-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url); if (url.origin !== location.origin) return;
  const shell = /\/(index\.html|boot\.js|app\.enc|app\.css|sw\.js)?$/.test(url.pathname);
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (shell) {               // réseau d'abord pour l'interface (mises à jour), cache si hors ligne
      try { const res = await fetch(req); if (res.ok) cache.put(url.origin + url.pathname, res.clone()); return res; }
      catch (err) { const hit = await cache.match(url.origin + url.pathname, {ignoreSearch:true}) || await cache.match(url.origin + url.pathname.replace(/\/$/, '/index.html')); if (hit) return hit; throw err; }
    }
    const hit = await cache.match(url.origin + url.pathname, {ignoreSearch:true, ignoreVary:true});
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok && res.status === 200) cache.put(url.origin + url.pathname, res.clone());
    return res;
  })());
});
