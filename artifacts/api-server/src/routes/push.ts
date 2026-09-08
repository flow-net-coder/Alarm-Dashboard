import { Router } from 'express';
import { pool } from '../db';
import { pushConfig, runDueAlarmPushes, sendAlarmPush, type PushSubscriptionRow, type ServerAlarm } from '../lib/push';

const router = Router();
const dayKeys = new Set(['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su']);

type ClientAlarm = {
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

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseAlarm(value: unknown): ClientAlarm | null {
  const alarm = value as Partial<ClientAlarm>;
  const id = asString(alarm.id);
  const label = asString(alarm.label);
  const time = asString(alarm.time);
  const meridiem = alarm.meridiem;
  const days = Array.isArray(alarm.days) ? alarm.days.filter((day) => dayKeys.has(day)) : [];
  const color = asString(alarm.color) || '#E69C73';
  const sound = asString(alarm.sound) || 'Soft chimes';

  if (!id || !time || (meridiem !== 'AM' && meridiem !== 'PM') || days.length === 0) {
    return null;
  }

  return {
    id,
    label: label || 'Untitled alarm',
    time,
    meridiem,
    days,
    color,
    enabled: alarm.enabled !== false,
    snooze: Number(alarm.snooze || 5),
    sound,
    dingCount: Number(alarm.dingCount || 1),
    note: asString(alarm.note),
  };
}

router.get('/push/public-key', (_req, res): void => {
  res.json({
    enabled: pushConfig.enabled,
    publicKey: pushConfig.publicKey,
  });
});

router.post('/push/subscribe', async (req, res): Promise<void> => {
  const body = req.body as {
    deviceId?: string;
    timezone?: string;
    subscription?: {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };
  };

  const deviceId = asString(body.deviceId);
  const timezone = asString(body.timezone) || 'UTC';
  const subscription = body.subscription;
  const endpoint = asString(subscription?.endpoint);

  if (!pushConfig.enabled) {
    res.status(503).json({ error: 'Server push is not configured. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.' });
    return;
  }

  if (!deviceId || !endpoint || !subscription?.keys?.p256dh || !subscription.keys.auth) {
    res.status(400).json({ error: 'deviceId and a valid PushSubscription are required' });
    return;
  }

  const { rows } = await pool.query(
    `
      INSERT INTO push_subscriptions (device_id, endpoint, subscription, timezone, updated_at)
      VALUES ($1, $2, $3::jsonb, $4, NOW())
      ON CONFLICT (endpoint)
      DO UPDATE SET
        device_id = EXCLUDED.device_id,
        subscription = EXCLUDED.subscription,
        timezone = EXCLUDED.timezone,
        updated_at = NOW()
      RETURNING id, device_id AS "deviceId", endpoint, subscription, timezone
    `,
    [deviceId, endpoint, JSON.stringify(subscription), timezone],
  );

  res.json({ subscription: rows[0] });
});

router.post('/push/alarms', async (req, res): Promise<void> => {
  const body = req.body as { deviceId?: string; timezone?: string; alarms?: unknown[] };
  const deviceId = asString(body.deviceId);
  const timezone = asString(body.timezone) || 'UTC';
  const alarms = Array.isArray(body.alarms) ? body.alarms.map(parseAlarm).filter((alarm): alarm is ClientAlarm => Boolean(alarm)) : [];

  if (!deviceId) {
    res.status(400).json({ error: 'deviceId is required' });
    return;
  }

  for (const alarm of alarms) {
    await pool.query(
      `
        INSERT INTO alarms (
          id, device_id, label, time, meridiem, days, color, enabled,
          snooze, sound, ding_count, note, timezone, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12, $13, NOW())
        ON CONFLICT (id)
        DO UPDATE SET
          device_id = EXCLUDED.device_id,
          label = EXCLUDED.label,
          time = EXCLUDED.time,
          meridiem = EXCLUDED.meridiem,
          days = EXCLUDED.days,
          color = EXCLUDED.color,
          enabled = EXCLUDED.enabled,
          snooze = EXCLUDED.snooze,
          sound = EXCLUDED.sound,
          ding_count = EXCLUDED.ding_count,
          note = EXCLUDED.note,
          timezone = EXCLUDED.timezone,
          updated_at = NOW()
      `,
      [
        alarm.id,
        deviceId,
        alarm.label,
        alarm.time,
        alarm.meridiem,
        JSON.stringify(alarm.days),
        alarm.color,
        alarm.enabled,
        alarm.snooze,
        alarm.sound,
        alarm.dingCount,
        alarm.note,
        timezone,
      ],
    );
  }

  const { rows: current } = await pool.query<{ id: string }>('SELECT id FROM alarms WHERE device_id = $1', [deviceId]);
  const incomingIds = new Set(alarms.map((alarm) => alarm.id));
  await Promise.all(
    current
      .filter((row) => !incomingIds.has(row.id))
      .map((row) => pool.query('DELETE FROM alarms WHERE id = $1 AND device_id = $2', [row.id, deviceId])),
  );

  res.json({ synced: alarms.length });
});

router.post('/push/test', async (req, res): Promise<void> => {
  const body = req.body as { deviceId?: string };
  const deviceId = asString(body.deviceId);

  if (!pushConfig.enabled) {
    res.status(503).json({ error: 'Server push is not configured. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.' });
    return;
  }

  if (!deviceId) {
    res.status(400).json({ error: 'deviceId is required' });
    return;
  }

  const { rows: alarms } = await pool.query<ServerAlarm>(
    `
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
      WHERE device_id = $1
      LIMIT 1
    `,
    [deviceId],
  );
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
    [deviceId],
  );

  const sent = alarms[0]
    ? await sendAlarmPush(alarms[0], subscriptions)
    : await Promise.resolve(0);

  res.json({ sent, subscriptions: subscriptions.length });
});

router.post('/push/run-due', async (_req, res): Promise<void> => {
  const result = await runDueAlarmPushes();
  res.json(result);
});

export default router;
