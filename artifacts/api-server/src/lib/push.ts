import webpush, { type PushSubscription } from 'web-push';
import { pool } from '../db';

const publicKey = process.env.VAPID_PUBLIC_KEY ?? '';
const privateKey = process.env.VAPID_PRIVATE_KEY ?? '';
const subject = process.env.VAPID_SUBJECT ?? process.env.APP_URL ?? 'mailto:buzzer@example.com';

export const pushConfig = {
  enabled: Boolean(publicKey && privateKey),
  publicKey,
};

export type ServerAlarm = {
  id: string;
  deviceId: string;
  label: string;
  time: string;
  meridiem: 'AM' | 'PM';
  days: string[];
  color: string;
  enabled: boolean;
  snooze: number;
  sound: string;
  dingCount: number;
  note: string | null;
  timezone: string;
  lastTriggeredKey: string | null;
};

export type PushSubscriptionRow = {
  id: string;
  deviceId: string;
  endpoint: string;
  subscription: PushSubscription;
  timezone: string;
};

if (pushConfig.enabled) {
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

const weekdayToKey: Record<string, string> = {
  Mon: 'mo',
  Tue: 'tu',
  Wed: 'we',
  Thu: 'th',
  Fri: 'fr',
  Sat: 'sa',
  Sun: 'su',
};

function localParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone || 'UTC',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  const hour = Number(value('hour'));
  return {
    weekday: weekdayToKey[value('weekday')] ?? 'mo',
    dateKey: `${value('year')}-${value('month')}-${value('day')}`,
    hour: hour === 24 ? 0 : hour,
    minute: Number(value('minute')),
  };
}

function alarmHour24(alarm: ServerAlarm) {
  const rawHour = Number(alarm.time.split(':')[0]);
  if (alarm.meridiem === 'AM' && rawHour === 12) return 0;
  if (alarm.meridiem === 'PM' && rawHour !== 12) return rawHour + 12;
  return rawHour;
}

function alarmMinute(alarm: ServerAlarm) {
  return Number(alarm.time.split(':')[1] ?? '0');
}

function isDue(alarm: ServerAlarm, now = new Date()) {
  const parts = localParts(now, alarm.timezone);
  const days = Array.isArray(alarm.days) ? alarm.days : [];
  if (!days.includes(parts.weekday)) return null;
  if (alarmHour24(alarm) !== parts.hour || alarmMinute(alarm) !== parts.minute) return null;

  const triggerKey = `${parts.dateKey}-${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
  return alarm.lastTriggeredKey === triggerKey ? null : triggerKey;
}

async function removeSubscription(endpoint: string) {
  await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
}

export async function sendAlarmPush(alarm: ServerAlarm, subscriptions: PushSubscriptionRow[]) {
  if (!pushConfig.enabled || subscriptions.length === 0) return 0;

  const payload = JSON.stringify({
    title: alarm.label || 'Alarm Ding!',
    body: alarm.note || `Time: ${alarm.time} ${alarm.meridiem}`,
    url: '/',
    alarm: {
      id: alarm.id,
      label: alarm.label,
      time: alarm.time,
      meridiem: alarm.meridiem,
      note: alarm.note,
    },
  });

  const results = await Promise.allSettled(
    subscriptions.map(async (row) => {
      try {
        await webpush.sendNotification(row.subscription as PushSubscription, payload);
        return true;
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await removeSubscription(row.endpoint);
        }
        throw err;
      }
    }),
  );

  return results.filter((result) => result.status === 'fulfilled').length;
}

export async function runDueAlarmPushes(now = new Date()) {
  if (!pushConfig.enabled) {
    return { checked: 0, sent: 0, skipped: 'push_not_configured' as const };
  }

  const { rows: alarms } = await pool.query<ServerAlarm>(`
    SELECT
      id,
      device_id AS "deviceId",
      label,
      time,
      meridiem,
      days,
      color,
      enabled,
      snooze,
      sound,
      ding_count AS "dingCount",
      note,
      timezone,
      last_triggered_key AS "lastTriggeredKey"
    FROM alarms
    WHERE enabled = TRUE
  `);
  let sent = 0;

  for (const alarm of alarms) {
    const triggerKey = isDue(alarm, now);
    if (!triggerKey) continue;

    const { rows: subscriptions } = await pool.query<PushSubscriptionRow>(
      `
        SELECT
          id,
          device_id AS "deviceId",
          endpoint,
          subscription,
          timezone
        FROM push_subscriptions
        WHERE device_id = $1
      `,
      [alarm.deviceId],
    );

    sent += await sendAlarmPush(alarm, subscriptions);
    await pool.query(
      'UPDATE alarms SET last_triggered_key = $1, updated_at = NOW() WHERE id = $2 AND device_id = $3',
      [triggerKey, alarm.id, alarm.deviceId],
    );
  }

  return { checked: alarms.length, sent };
}
