import { db, actionItemsTable, heartbeatLogsTable } from '../db';
import { eq } from 'drizzle-orm';
import { generateHeartbeatSummary } from './groq';
import {
  getMarcusContext,
  updateMarcusContext,
  getConversationsSince,
} from './memory';
import { generateMarkdownFiles } from './markdown';
import { count } from 'drizzle-orm';

let lastHeartbeatAt: Date = new Date(Date.now() - 60 * 60 * 1000); // default: 1hr ago

/**
 * Run the marcus heartbeat.
 * - Compiles recent conversations
 * - Updates marcus context
 * - Extracts any missed action items
 * - Generates .md state files
 */
export async function runHeartbeat(): Promise<{
  summary: string;
  conversationsProcessed: number;
  actionItemsCreated: number;
}> {
  console.log('[heartbeat] Running at', new Date().toISOString());

  const since = lastHeartbeatAt;
  lastHeartbeatAt = new Date();

  // 1. Get recent conversations
  const recentMessages = await getConversationsSince(since);

  // 2. Get current context and pending action count
  const context = await getMarcusContext();
  const [pendingResult] = await db
    .select({ count: count() })
    .from(actionItemsTable)
    .where(eq(actionItemsTable.status, 'pending'));
  const pendingCount = pendingResult?.count ?? 0;

  // 3. Generate heartbeat summary via Groq
  const result = await generateHeartbeatSummary(
    recentMessages.map((m) => ({ role: m.role, content: m.content })),
    context,
    Number(pendingCount),
  );

  // 4. Save any new action items found during heartbeat
  let actionItemsCreated = 0;
  if (result.new_action_items.length > 0) {
    await db.insert(actionItemsTable).values(
      result.new_action_items.map((item) => ({
        type: item.type,
        title: item.title,
        description: item.description ?? null,
        details: item.details ?? null,
        status: 'pending' as const,
        dueDate: item.due_date ? new Date(item.due_date) : null,
      })),
    );
    actionItemsCreated = result.new_action_items.length;
  }

  // 5. Update context
  if (Object.keys(result.context_updates).length > 0) {
    await updateMarcusContext(result.context_updates);
  }

  // 6. Write .md state files
  await generateMarkdownFiles();

  // 7. Log the heartbeat run
  await db.insert(heartbeatLogsTable).values({
    conversationsProcessed: recentMessages.length,
    actionItemsCreated,
    summary: result.summary,
  });

  console.log(
    `[heartbeat] Done — ${recentMessages.length} messages processed, ${actionItemsCreated} action items created`,
  );

  return {
    summary: result.summary,
    conversationsProcessed: recentMessages.length,
    actionItemsCreated,
  };
}
