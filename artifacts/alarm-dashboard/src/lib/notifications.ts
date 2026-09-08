// Browser Notification Helper

import { getPushPublicKey, savePushSubscription, syncPushAlarms } from '@/api';

type PushSyncAlarm = {
  id: string;
  label: string;
  time: string;
  meridiem: 'AM' | 'PM';
  days: string[];
  color: string;
  enabled: boolean;
  snooze: number;
  sound: string;
  dingCount?: number;
  note?: string;
};

const DEVICE_ID_KEY = 'buzzer-device-id';

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('Notifications not supported in this browser environment.');
    return false;
  }
  if (Notification.permission === 'granted') {
    return true;
  }
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return false;
}

export function getDeviceId() {
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;

  const id = crypto.randomUUID();
  localStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

export function getNotificationPermissionState(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

function getTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export async function registerServerPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { enabled: false, reason: 'unsupported' as const };
  }

  const { enabled, publicKey } = await getPushPublicKey();
  if (!enabled || !publicKey) {
    return { enabled: false, reason: 'server_not_configured' as const };
  }

  const permissionGranted = await requestNotificationPermission();
  if (!permissionGranted) {
    return { enabled: false, reason: 'permission_not_granted' as const };
  }

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));

  const deviceId = getDeviceId();
  await savePushSubscription(deviceId, subscription, getTimezone());
  return { enabled: true, deviceId };
}

export async function syncAlarmsForServerPush(alarms: PushSyncAlarm[]) {
  const deviceId = getDeviceId();
  await syncPushAlarms(deviceId, alarms, getTimezone());
}

export async function sendAlarmNotification(title: string, options?: NotificationOptions) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const notificationOptions: NotificationOptions = {
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        requireInteraction: true,
        ...options,
      };

      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready.catch(() => null);
        if (registration) {
          await registration.showNotification(title, notificationOptions);
          return;
        }
      }

      const notif = new Notification(title, notificationOptions);
      notif.onclick = () => {
        window.focus();
        notif.close();
      };
    } catch (e) {
      console.warn('Could not trigger notification:', e);
    }
  }
}
