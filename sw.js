/**
 * Service Worker pro MoneyCount PWA
 * Verze 3.2 - Automatická aktualizace a verzování
 */

const CACHE_NAME = 'moneycount-v3.2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css?v=3.2',
  './qr.js?v=3.2',
  './app.js?v=3.2',
  './manifest.json',
  './favicon.ico',
  './favicon.png',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/favicon.ico'
];

// Instalace - okamžité nahrazení starého service workeru
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('Některé soubory se nepodařilo uložit do cache:', err);
      });
    })
  );
});

// Aktivace - smazání starých verzí cache a okamžité převzetí kontroly nad klienty
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Zpráva pro okamžitou aktivaci
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch strategie:
// Pro HTML, JS a CSS požadavky: Network-First (nejnovější verze z webu, cache jako offline záloha)
// Pro ostatní statika: Stale-While-Revalidate
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isCodeAsset = event.request.mode === 'navigate' || 
                      url.pathname.endsWith('.html') || 
                      url.pathname.endsWith('.js') || 
                      url.pathname.endsWith('.css');

  if (isCodeAsset) {
    // Network First
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request).then((cached) => {
            if (cached) return cached;
            if (event.request.mode === 'navigate') {
              return caches.match('./index.html');
            }
          });
        })
    );
    return;
  }

  // Pro ikony a obrázky: Cache First se Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse.clone()));
          }
        }).catch(() => {});
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const copy = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return networkResponse;
      }).catch(() => {});
    })
  );
});
