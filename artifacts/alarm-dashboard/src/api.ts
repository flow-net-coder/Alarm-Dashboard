const BASE = import.meta.env.VITE_API_URL ?? '/api';

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

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export async function sendMessage(message: string): Promise<{ reply: string; timestamp: string }> {
  return json(
    await fetch(`${BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    }),
  );
}

export async function getHistory(limit = 60): Promise<Message[]> {
  const data = await json<{ messages: Message[] }>(
    await fetch(`${BASE}/chat/history?limit=${limit}`),
  );
  return data.messages;
}

export async function getActions(status?: string): Promise<ActionItem[]> {
  const q = status ? `?status=${status}` : '';
  const data = await json<{ actions: ActionItem[] }>(await fetch(`${BASE}/actions${q}`));
  return data.actions;
}

export async function updateAction(
  id: string,
  status: string,
): Promise<ActionItem> {
  return json(
    await fetch(`${BASE}/actions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }),
  );
}

export async function getMarcusState(): Promise<MarcusState> {
  return json(await fetch(`${BASE}/marcus`));
}

export async function triggerHeartbeat(): Promise<{
  summary: string;
  conversationsProcessed: number;
  actionItemsCreated: number;
  ranAt: string;
}> {
  return json(await fetch(`${BASE}/heartbeat`, { method: 'POST' }));
}

export async function setMarcusContext(updates: Record<string, string>): Promise<void> {
  await json(
    await fetch(`${BASE}/marcus/context`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }),
  );
}
