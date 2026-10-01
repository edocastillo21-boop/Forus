// Forus: al tocar una notificación (fin del descanso) se vuelve a la app abierta.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const win = all.find((c) => 'focus' in c);
    if (win) return win.focus();
    return self.clients.openWindow('/');
  })());
});
