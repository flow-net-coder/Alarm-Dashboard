import { db, marcusContextTable, conversationsTable, actionItemsTable } from '../db';
import { eq, desc, gte } from 'drizzle-orm';
import type { ChatMessage } from './groq';

const MANAGER_NAME = process.env.MANAGER_NAME ?? 'Marcus';
const HISTORY_WINDOW = parseInt(process.env.HISTORY_WINDOW ?? '20', 10);

/**
 * Load all marcus context key-value pairs from the database.
 */
export async function getMarcusContext(): Promise<Record<string, string>> {
  const rows = await db.select().from(marcusContextTable);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

/**
 * Upsert context key-value pairs.
 */
export async function updateMarcusContext(updates: Record<string, string>): Promise<void> {
  if (Object.keys(updates).length === 0) return;

  for (const [key, value] of Object.entries(updates)) {
    await db
      .insert(marcusContextTable)
      .values({ key, value })
      .onConflictDoUpdate({
        target: marcusContextTable.key,
        set: { value, updatedAt: new Date() },
      });
  }
}

/**
 * Get the last N conversation messages for LLM context.
 */
export async function getRecentHistory(limit = HISTORY_WINDOW): Promise<ChatMessage[]> {
  const rows = await db
    .select()
    .from(conversationsTable)
    .orderBy(desc(conversationsTable.createdAt))
    .limit(limit);

  return rows
    .reverse()
    .map((r) => ({ role: r.role as 'user' | 'assistant', content: r.content }));
}

/**
 * Get conversations since a specific timestamp (for heartbeat).
 */
export async function getConversationsSince(since: Date): Promise<Array<{ role: string; content: string; createdAt: Date }>> {
  const rows = await db
    .select()
    .from(conversationsTable)
    .where(gte(conversationsTable.createdAt, since))
    .orderBy(conversationsTable.createdAt);

  return rows.map((r) => ({ role: r.role, content: r.content, createdAt: r.createdAt }));
}

/**
 * Save a message pair (user + assistant) to the database.
 */
export async function saveMessages(
  userContent: string,
  assistantContent: string,
  userMetadata?: Record<string, unknown>,
): Promise<{ userId: string; assistantId: string }> {
  const today = new Date().toISOString().split('T')[0]!;

  const [userRow] = await db
    .insert(conversationsTable)
    .values({ role: 'user', content: userContent, sessionDate: today, metadata: userMetadata ?? null })
    .returning({ id: conversationsTable.id });

  const [assistantRow] = await db
    .insert(conversationsTable)
    .values({ role: 'assistant', content: assistantContent, sessionDate: today })
    .returning({ id: conversationsTable.id });

  return { userId: userRow!.id, assistantId: assistantRow!.id };
}

/**
 * Build the system prompt for the marcus from stored context and pending actions.
 */
export async function buildSystemPrompt(): Promise<string> {
  const context = await getMarcusContext();
  const pendingActions = await db
    .select()
    .from(actionItemsTable)
    .where(eq(actionItemsTable.status, 'pending'));

  const userName = context['user_name'] ?? 'the user';
  const company = context['company_name'] ? ` at ${context['company_name']}` : '';

  const contextLines = Object.entries(context)
    .filter(([k]) => !['user_name', 'company_name'].includes(k))
    .map(([k, v]) => `- ${k.replace(/_/g, ' ')}: ${v}`)
    .join('\n');

  const actionLines = pendingActions
    .slice(0, 15)
    .map((a) => `- [${a.type.toUpperCase()}] ${a.title}${a.dueDate ? ` (due: ${new Date(a.dueDate).toLocaleDateString()})` : ''}`)
    .join('\n');

  return `You are ${MANAGER_NAME}, an intelligent AI business marcus helping ${userName}${company}.

YOUR ROLE:
- Remember and track everything ${userName} tells you
- When they mention a task, meeting, email, call, or reminder — acknowledge it and confirm it's tracked
- Be proactive: ask for missing details (who, when, where) when something is vague
- Keep responses concise, professional, and warm
- You are the management brain of their workflow — always thinking ahead

WHAT YOU TRACK:
- Tasks and to-dos with deadlines
- Meetings and calendar events
- Emails and messages to send or follow up on
- Calls to make
- Important people and relationships
- Deadlines and time-sensitive items
- Saved website shortcuts that the Buzzer client can open when the user asks
- Alarm requests that the Buzzer client can turn into real enabled alarms

${contextLines ? `WHAT YOU KNOW ABOUT ${userName.toUpperCase()}:\n${contextLines}\n` : ''}
${pendingActions.length > 0 ? `CURRENT PENDING ACTION ITEMS (${pendingActions.length} total):\n${actionLines}\n` : ''}
IMPORTANT RULES:
- When ${userName} mentions something actionable, always confirm: "Got it, I've noted..." or "I'll flag that for follow-up."
- Never make up facts you weren't told
- If you're unsure about a date or detail, ask for clarification
- You cannot send emails or make calls yourself. You can help open saved website shortcuts and set alarms when the Buzzer client detects a matching request.
- Responses should be 1–4 sentences unless detail is needed`;
}
