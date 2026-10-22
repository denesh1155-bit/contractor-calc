// offline: the app shell is cached at install; tales and pictures are cached as they are played
const SHELL = 'zghaprebi-shell-v1', MEDIA = 'zghaprebi-media-v2';
const CORE = ['./', './index.html', './tales.json', './plans.json', './audio/timings.json', './audio/lips.json', './manifest.webmanifest'];
self.addEventListener('install', e => e.waitUntil(caches.open(SHELL).then(c => c.addAll(CORE)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== SHELL && k !== MEDIA).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const media = /\.(mp3|png|webp)$/.test(url.pathname);
  // the shell: fresh when online, cached when not; media: cached first (big files, never change for a version)
  e.respondWith(media
    ? caches.open(MEDIA).then(c => c.match(e.request).then(hit => hit || fetch(e.request).then(r => { if (r.ok && r.status === 200) c.put(e.request, r.clone()); return r; })))
    : fetch(e.request).then(r => { if (r.ok) caches.open(SHELL).then(c => c.put(e.request, r.clone())); return r; }).catch(() => caches.match(e.request)));
});
