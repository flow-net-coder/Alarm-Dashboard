import { Capacitor } from '@capacitor/core';
import { LocalNotifications, type ActionPerformed, type Channel, type ScheduleOptions } from '@capacitor/local-notifications';
import type { Alarm } from '@/App';

const DEFAULT_ALARM_SOUND_KEY = 'Soft chimes';
const SOUND_CONFIG: Record<string, { channelId: string; file: string; name: string }> = {
  'Soft chimes': {
    channelId: 'buzzer_soft_chimes_v1',
    file: 'buzzer_soft_chimes.wav',
    name: 'Soft chimes',
  },
  Woodland: {
    channelId: 'buzzer_woodland_v1',
    file: 'buzzer_woodland.wav',
    name: 'Woodland',
  },
  'Low tide': {
    channelId: 'buzzer_low_tide_v1',
    file: 'buzzer_low_tide.wav',
    name: 'Low tide',
  },
  'Night air': {
    channelId: 'buzzer_night_air_v1',
    file: 'buzzer_night_air.wav',
    name: 'Night air',
  },
  'Single Ding': {
    channelId: 'buzzer_single_ding_v1',
    file: 'buzzer_single_ding.wav',
    name: 'Single Ding',
  },
  'Multi-Ding (Urgent)': {
    channelId: 'buzzer_urgent_v1',
    file: 'buzzer_urgent.wav',
    name: 'Urgent multi-ding',
  },
};
const ALARM_ACTION_TYPE = 'buzzer_alarm_actions';
const WEBSITE_ACTION_TYPE = 'buzzer_website_actions';
const SNOOZE_ACTION_ID = 'snooze';
const DISMISS_ACTION_ID = 'dismiss';
const OPEN_ACTION_ID = 'open';

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

function soundConfig(sound?: string) {
  return SOUND_CONFIG[sound ?? DEFAULT_ALARM_SOUND_KEY] ?? SOUND_CONFIG[DEFAULT_ALARM_SOUND_KEY];
}

function alarmChannelIds() {
  return Object.values(SOUND_CONFIG).map((config) => config.channelId);
}

async function ensureAlarmChannels() {
  if (!isNativeApp()) return;

  await Promise.all(
    Object.values(SOUND_CONFIG).map((config) =>
      LocalNotifications.createChannel({
        id: config.channelId,
        name: `Buzzer - ${config.name}`,
        description: `${config.name} alarm notifications from Buzzer.`,
        importance: 5,
        visibility: 1,
        vibration: true,
        lights: true,
        lightColor: '#E69C73',
        sound: config.file,
      }).catch(() => undefined),
    ),
  );
}

export type NativeAlarmHealth = {
  displayPermission: 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale';
  exactAlarmPermission: 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' | 'unknown';
  pendingCount: number;
  alarmChannelReady: boolean;
};

export async function getNativeAlarmHealth(): Promise<NativeAlarmHealth | null> {
  if (!isNativeApp()) return null;

  const [permissions, exact, pending, channels] = await Promise.all([
    LocalNotifications.checkPermissions(),
    LocalNotifications.checkExactNotificationSetting().catch(() => ({ exact_alarm: 'unknown' as const })),
    LocalNotifications.getPending().catch(() => ({ notifications: [] })),
    LocalNotifications.listChannels().catch(() => ({ channels: [] as Channel[] })),
  ]);

  return {
    displayPermission: permissions.display,
    exactAlarmPermission: exact.exact_alarm,
    pendingCount: pending.notifications.length,
    alarmChannelReady: alarmChannelIds().every((channelId) =>
      channels.channels.some((channel) => channel.id === channelId),
    ),
  };
}

export async function registerNativeAlarmActions() {
  if (!isNativeApp()) return;
  await LocalNotifications.registerActionTypes({
    types: [
      {
        id: ALARM_ACTION_TYPE,
        actions: [
          { id: SNOOZE_ACTION_ID, title: 'Snooze', foreground: true },
          { id: DISMISS_ACTION_ID, title: 'Dismiss', foreground: true },
        ],
      },
      {
        id: WEBSITE_ACTION_TYPE,
        actions: [{ id: OPEN_ACTION_ID, title: 'Open', foreground: true }],
      },
    ],
  }).catch(() => undefined);
}

export async function listenForNativeAlarmActions(
  onAction: (event: { action: 'snooze' | 'dismiss' | 'open'; alarmId?: string; url?: string }) => void,
) {
  if (!isNativeApp()) return undefined;
  const handle = await LocalNotifications.addListener('localNotificationActionPerformed', (event: ActionPerformed) => {
    const alarmId = typeof event.notification.extra?.alarmId === 'string' ? event.notification.extra.alarmId : undefined;
    const url = typeof event.notification.extra?.url === 'string' ? event.notification.extra.url : undefined;
    if (event.actionId === SNOOZE_ACTION_ID || event.actionId === DISMISS_ACTION_ID) {
      onAction({ action: event.actionId, alarmId });
      return;
    }
    if (event.actionId === OPEN_ACTION_ID || (event.notification.extra?.kind === 'open_website' && url)) {
      onAction({ action: 'open', url });
    }
  });
  return () => {
    void handle.remove();
  };
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

  await ensureAlarmChannels();
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
  const selectedSound = soundConfig(alarm.sound);
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
    channelId: selectedSound.channelId,
    sound: selectedSound.file,
    actionTypeId: ALARM_ACTION_TYPE,
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
  const selectedSound = soundConfig(DEFAULT_ALARM_SOUND_KEY);

  await LocalNotifications.schedule({
    notifications: [
      {
        id: Date.now() % 2147483647,
        title: 'Buzzer notifications are on',
        body: 'Native Android alarms can now ring outside the app.',
        schedule: { at: new Date(Date.now() + 1500), allowWhileIdle: true },
        channelId: selectedSound.channelId,
        sound: selectedSound.file,
        actionTypeId: ALARM_ACTION_TYPE,
        foreground: true,
        iconColor: '#E69C73',
        extra: { kind: 'native-test' },
      },
    ],
  });

  return true;
}

export async function scheduleNativeReminder(options: { title: string; body: string; at: Date; url?: string }) {
  if (!isNativeApp()) return false;

  const granted = await requestNativeAlarmPermissions();
  if (!granted) return false;
  const selectedSound = soundConfig(DEFAULT_ALARM_SOUND_KEY);

  await LocalNotifications.schedule({
    notifications: [
      {
        id: Date.now() % 2147483647,
        title: options.title,
        body: options.body,
        schedule: { at: options.at, allowWhileIdle: true },
        channelId: selectedSound.channelId,
        sound: selectedSound.file,
        actionTypeId: options.url ? WEBSITE_ACTION_TYPE : ALARM_ACTION_TYPE,
        foreground: true,
        iconColor: '#E69C73',
        extra: {
          kind: options.url ? 'open_website' : 'marcus_reminder',
          url: options.url,
        },
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
