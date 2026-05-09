self.addEventListener('install', (e) => {
  console.log('Service Worker installed');
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', (e) => {
  // Don't intercept navigation requests (HTML pages)
  // This prevents fetch errors on both localhost and production
  if (e.request.mode === 'navigate') return;

  // For all other requests (JS, CSS, images etc), just pass through
  e.respondWith(fetch(e.request));
});
