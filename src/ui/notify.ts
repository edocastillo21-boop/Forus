// Notificaciones locales (fin del descanso). Las muestra el service worker para que funcionen con la app
// en segundo plano. Limitación de la web: con el teléfono bloqueado, Android las entrega casi siempre;
// iPhone solo si la app está instalada y aun así pausa los temporizadores al bloquear.

export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;

export async function askNotifications(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  return (await Notification.requestPermission()) === 'granted';
}

export async function notify(title: string, body: string, tag = 'forus') {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  const opts = { body, tag, renotify: true, icon: '/icon-192.png', badge: '/icon-192.png', vibrate: [200, 100, 200], silent: false } as NotificationOptions;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) await reg.showNotification(title, opts);
    else new Notification(title, opts);
  } catch { /* sin permiso o sin service worker: el sonido en la app sigue funcionando */ }
}

export async function closeNotifications(tag: string) {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    (await reg?.getNotifications({ tag }))?.forEach((n) => n.close());
  } catch { /* nada que cerrar */ }
}
