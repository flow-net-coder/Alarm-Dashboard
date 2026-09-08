import { Capacitor } from '@capacitor/core';
import { LocalNotifications, type ScheduleOptions } from '@capacitor/local-notifications';
import type { Alarm } from '@/App';

const ALARM_CHANNEL_ID = 'buzzer_alarm_v2';
const ALARM_SOUND = 'buzzer_alarm.wav';

const dayToDateDay: Record<string, number> = {
  su: 0,
  mo: 1,
  tu: 2,
  we: 3,
  th: 4,
  fr: 5,
  sa: 6,
};

export function isNativeApp() {
  return Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'web';
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

function nextOccurrence(day: string, hour: number, minute: number) {
  const target = new Date();
  target.setHours(hour, minute, 0, 0);

  const targetDay = dayToDateDay[day] ?? target.getDay();
  let daysUntil = (targetDay - target.getDay() + 7) % 7;
  if (daysUntil === 0 && target.getTime() <= Date.now()) {
    daysUntil = 7;
  }
  target.setDate(target.getDate() + daysUntil);
  return target;
}

async function ensureAlarmChannel() {
  if (!isNativeApp()) return;

  await LocalNotifications.createChannel({
    id: ALARM_CHANNEL_ID,
    name: 'Buzzer alarms',
    description: 'Alarm notifications from Buzzer.',
    importance: 5,
    visibility: 1,
    vibration: true,
    lights: true,
    lightColor: '#E69C73',
    sound: ALARM_SOUND,
  }).catch(() => undefined);
}

export async function requestNativeAlarmPermissions() {
  if (!isNativeApp()) return false;

  const current = await LocalNotifications.checkPermissions();
  if (current.display !== 'granted') {
    const requested = await LocalNotifications.requestPermissions();
    if (requested.display !== 'granted') return false;
  }

  try {
    let exact = await LocalNotifications.checkExactNotificationSetting();
    if (exact.exact_alarm !== 'granted') {
      exact = await LocalNotifications.changeExactNotificationSetting();
    }
    if (exact.exact_alarm !== 'granted') return false;
  } catch {
    // Exact alarm settings are Android-only; iOS/web do not need this path.
  }

  await ensureAlarmChannel();
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
      at: nextOccurrence(day, hour, minute),
      every: 'week',
      repeats: true,
      allowWhileIdle: true,
    },
    channelId: ALARM_CHANNEL_ID,
    sound: ALARM_SOUND,
    foreground: true,
    isExactNotification: true,
    isExactMandatory: true,
    iconColor: '#E69C73',
    extra: {
      alarmId: alarm.id,
    },
  }));

  const result = await LocalNotifications.schedule({ notifications });
  if (result.warning) {
    throw new Error(result.warning.message);
  }
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
        channelId: ALARM_CHANNEL_ID,
        sound: ALARM_SOUND,
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
  const current = await LocalNotifications.checkPermissions();
  if (current.display !== 'granted') return;
  await Promise.all(alarms.map((alarm) => (alarm.enabled ? scheduleNativeAlarm(alarm) : cancelNativeAlarm(alarm))));
}
