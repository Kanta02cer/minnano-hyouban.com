'use strict';

// One-time replacement for the former service worker. It installs, removes
// old caches, then unregisters itself. New pages do not register a worker.
self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('mhcom-')).map(name => caches.delete(name)));
    await self.registration.unregister();
  })());
});
