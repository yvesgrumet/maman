// Service Worker — Suivi Maman 💛
const CACHE = 'suivi-maman-v1';

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll([
      '/', '/index.html', '/maman-tablette.html',
      '/icon-famille.png', '/icon-maman.png'
    ]).catch(()=>{}))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});

// Afficher les notifications push reçues
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {};
  e.waitUntil(
    self.registration.showNotification(data.title || '💛 Suivi Maman', {
      body: data.body || '',
      icon: '/icon-famille.png',
      badge: '/icon-famille.png',
      vibrate: data.urgent ? [300,100,300,100,300] : [200,100,200],
      tag: 'suivi-maman',
      renotify: true,
      requireInteraction: data.urgent || false
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow('/'));
});
