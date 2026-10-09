// Service worker for the admin app: shows booking alerts even when the app is closed.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {}); // network as usual (keeps the app installable)

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  e.waitUntil((async () => {
    await self.registration.showNotification(d.title || 'New booking', {
      body: d.body || '',
      icon: '/icon-192.png',
      badge: '/badge.png',
      tag: d.tag || undefined,
      renotify: !!d.tag,
      vibrate: [180, 80, 180],
      timestamp: Date.now(),
      data: { url: d.url || '/admin' }
    });
    if (self.navigator.setAppBadge) { try { await self.navigator.setAppBadge(); } catch {} }
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    wins.forEach(w => w.postMessage({ type: 'booking', url: d.url }));
  })());
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || '/admin', self.location.origin).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const w = wins.find(c => new URL(c.url).pathname.startsWith('/admin'));
    if (w) { await w.focus(); w.postMessage({ type: 'open', url }); return; }
    await self.clients.openWindow(url);
  })());
});
