import { Capacitor } from '@capacitor/core';
import { LocalNotifications, Weekday, type ScheduleOptions } from '@capacitor/local-notifications';
import type { Alarm } from '@/App';

const dayToJsDay: Record<string, number> = {
  su: Weekday.Sunday,
  mo: Weekday.Monday,
  tu: Weekday.Tuesday,
  we: Weekday.Wednesday,
  th: Weekday.Thursday,
  fr: Weekday.Friday,
  sa: Weekday.Saturday,
};

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

function notificationId(alarm: Alarm, day: string) {
  let hash = 0;
  const source = `${alarm.id}-${day}`;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) | 0;
  }
  return Math.abs(hash) || 1;
}

function parseAlarmTime(alarm: Alarm) {
  const [rawHour, rawMinute] = alarm.time.split(':').map(Number);
  let hour = rawHour;
  if (alarm.meridiem === 'AM' && hour === 12) hour = 0;
  if (alarm.meridiem === 'PM' && hour !== 12) hour += 12;
  return { hour, minute: rawMinute || 0 };
}

export async function requestNativeAlarmPermissions() {
  if (!isNativeApp()) return false;

  const current = await LocalNotifications.checkPermissions();
  if (current.display !== 'granted') {
    const requested = await LocalNotifications.requestPermissions();
    if (requested.display !== 'granted') return false;
  }

  try {
    const exact = await LocalNotifications.checkExactNotificationSetting();
    if (exact.exact_alarm !== 'granted') {
      const changed = await LocalNotifications.changeExactNotificationSetting();
      return changed.exact_alarm === 'granted';
    }
  } catch {
    // Exact alarm settings are Android-only; iOS/web do not need this path.
  }

  return true;
}

export async function cancelNativeAlarm(alarm: Alarm) {
  if (!isNativeApp()) return;
  await LocalNotifications.cancel({
    notifications: alarm.days.map((day) => ({ id: notificationId(alarm, day) })),
  });
}

export async function scheduleNativeAlarm(alarm: Alarm) {
  if (!isNativeApp()) return;

  await cancelNativeAlarm(alarm);
  if (!alarm.enabled) return;

  const granted = await requestNativeAlarmPermissions();
  if (!granted) return;

  const { hour, minute } = parseAlarmTime(alarm);
  const notifications: ScheduleOptions['notifications'] = alarm.days.map((day) => ({
    id: notificationId(alarm, day),
    title: alarm.label || 'Alarm Ding!',
    body: alarm.note || `Time: ${alarm.time} ${alarm.meridiem}`,
    schedule: {
      on: {
        weekday: dayToJsDay[day],
        hour,
        minute,
      },
      repeats: true,
      allowWhileIdle: true,
    },
    sound: undefined,
    foreground: true,
    isExactNotification: true,
    isExactMandatory: true,
    iconColor: '#E69C73',
    extra: {
      alarmId: alarm.id,
    },
  }));

  await LocalNotifications.schedule({ notifications });
}

export async function sendNativeTestNotification() {
  if (!isNativeApp()) return false;

  const granted = await requestNativeAlarmPermissions();
  if (!granted) return false;

  await LocalNotifications.schedule({
    notifications: [
      {
        id: Date.now() % 2147483647,
        title: 'Buzzer notifications are on',
        body: 'Native Android alarms can now ring outside the app.',
        schedule: { at: new Date(Date.now() + 1500), allowWhileIdle: true },
        foreground: true,
        iconColor: '#E69C73',
        extra: { kind: 'native-test' },
      },
    ],
  });

  return true;
}

export async function syncNativeAlarms(alarms: Alarm[]) {
  if (!isNativeApp()) return;
  await Promise.all(alarms.map((alarm) => (alarm.enabled ? scheduleNativeAlarm(alarm) : cancelNativeAlarm(alarm))));
}
