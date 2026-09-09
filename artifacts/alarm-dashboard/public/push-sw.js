self.addEventListener('push', (event) => {
  const data = event.data?.json?.() ?? {};
  const title = data.title || 'Alarm Ding!';
  const options = {
    body: data.body || 'Your Buzzer alarm is ringing.',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    requireInteraction: true,
    actions: [
      { action: 'open', title: 'Open Buzzer' },
      { action: 'marcus', title: 'Ask Marcus' },
    ],
    data: {
      url: data.url || '/',
      alarm: data.alarm || null,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.action === 'marcus' ? '/?tab=marcus' : event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate?.(url);
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }

      return undefined;
    }),
  );
});
