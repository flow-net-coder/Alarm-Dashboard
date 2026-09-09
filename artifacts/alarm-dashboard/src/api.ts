import { Capacitor } from '@capacitor/core';

const CONFIGURED_BASE = import.meta.env.VITE_API_URL as string | undefined;
const DEFAULT_REMOTE_BASE = 'https://flow-net-web-production.up.railway.app/api';
const API_URL_STORAGE_KEY = 'buzzer-api-url';

export function normalizeApiBaseUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
}

export function getApiBaseUrl() {
  const savedBase = localStorage.getItem(API_URL_STORAGE_KEY);
  if (Capacitor.isNativePlatform() && savedBase && (savedBase === '/api' || savedBase.includes('localhost') || savedBase.includes('capacitor://'))) {
    localStorage.removeItem(API_URL_STORAGE_KEY);
    return CONFIGURED_BASE || DEFAULT_REMOTE_BASE;
  }
  return savedBase || CONFIGURED_BASE || DEFAULT_REMOTE_BASE;
}

export function saveApiBaseUrl(value: string) {
  const normalized = normalizeApiBaseUrl(value);
  if (normalized) {
    localStorage.setItem(API_URL_STORAGE_KEY, normalized);
  } else {
    localStorage.removeItem(API_URL_STORAGE_KEY);
  }
  return normalized;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sessionDate: string;
  createdAt: string;
}

export interface ActionItem {
  id: string;
  type: string;
  title: string;
  description?: string | null;
  details?: Record<string, unknown> | null;
  status: string;
  dueDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MarcusState {
  name: string;
  context: Record<string, string>;
  lastHeartbeat: {
    id: string;
    ranAt: string;
    conversationsProcessed: number;
    actionItemsCreated: number;
    summary?: string | null;
  } | null;
}

export interface PushPublicKeyResponse {
  enabled: boolean;
  publicKey: string;
}

export type AssistantContext = {
  timezone?: string;
  locale?: string;
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    timezone?: string;
  } | null;
};

async function json<T>(res: Response): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  if (!res.ok) {
    const err = contentType.includes('application/json')
      ? await res.json().catch(() => ({ error: res.statusText }))
      : { error: await res.text().then(() => res.statusText).catch(() => res.statusText) };
    throw new Error((err as { error: string }).error ?? res.statusText);
  }
  if (!contentType.includes('application/json')) {
    throw new Error('Marcus API returned a web page instead of JSON. Set the APK API URL to your Railway /api URL.');
  }
  return res.json() as Promise<T>;
}

export async function sendMessage(message: string, context?: AssistantContext): Promise<{ reply: string; timestamp: string }> {
  return json(
    await fetch(`${getApiBaseUrl()}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, context }),
    }),
  );
}

export async function getHistory(limit = 60): Promise<Message[]> {
  const data = await json<{ messages: Message[] }>(
    await fetch(`${getApiBaseUrl()}/chat/history?limit=${limit}`),
  );
  return data.messages;
}

export async function getActions(status?: string): Promise<ActionItem[]> {
  const q = status ? `?status=${status}` : '';
  const data = await json<{ actions: ActionItem[] }>(await fetch(`${getApiBaseUrl()}/actions${q}`));
  return data.actions;
}

export async function updateAction(
  id: string,
  status: string,
): Promise<ActionItem> {
  return json(
    await fetch(`${getApiBaseUrl()}/actions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }),
  );
}

export async function getMarcusState(): Promise<MarcusState> {
  return json(await fetch(`${getApiBaseUrl()}/marcus`));
}

export async function triggerHeartbeat(): Promise<{
  summary: string;
  conversationsProcessed: number;
  actionItemsCreated: number;
  ranAt: string;
}> {
  return json(await fetch(`${getApiBaseUrl()}/heartbeat`, { method: 'POST' }));
}

export async function setMarcusContext(updates: Record<string, string>): Promise<void> {
  await json(
    await fetch(`${getApiBaseUrl()}/marcus/context`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }),
  );
}

export async function getPushPublicKey(): Promise<PushPublicKeyResponse> {
  return json(await fetch(`${getApiBaseUrl()}/push/public-key`));
}

export async function savePushSubscription(
  deviceId: string,
  subscription: PushSubscription,
  timezone: string,
): Promise<void> {
  await json(
    await fetch(`${getApiBaseUrl()}/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, subscription, timezone }),
    }),
  );
}

export async function syncPushAlarms(
  deviceId: string,
  alarms: unknown[],
  timezone: string,
): Promise<void> {
  await json(
    await fetch(`${getApiBaseUrl()}/push/alarms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, alarms, timezone }),
    }),
  );
}

export async function sendTestPush(deviceId: string): Promise<{ sent: number; subscriptions: number }> {
  return json(
    await fetch(`${getApiBaseUrl()}/push/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId }),
    }),
  );
}
