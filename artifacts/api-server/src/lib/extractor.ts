import { db, actionItemsTable, conversationsTable } from '../db';
import { extractEntities, updateMarcusContext } from './groq';
import { updateMarcusContext as saveContext } from './memory';

/**
 * Process a conversation exchange asynchronously.
 * Extracts action items + context updates and persists them.
 * This is called fire-and-forget after each chat turn.
 */
export async function processExchange(
  userMessage: string,
  aiResponse: string,
  sourceMessageId?: string,
): Promise<void> {
  try {
    const result = await extractEntities(userMessage, aiResponse);

    // Save action items
    if (result.action_items.length > 0) {
      await db.insert(actionItemsTable).values(
        result.action_items.map((item) => ({
          type: item.type,
          title: item.title,
          description: item.description ?? null,
          details: item.details ?? null,
          status: 'pending' as const,
          dueDate: item.due_date ? new Date(item.due_date) : null,
          sourceMessageId: sourceMessageId ?? null,
        })),
      );
    }

    // Save context updates
    if (Object.keys(result.context_updates).length > 0) {
      await saveContext(result.context_updates);
    }
  } catch (err) {
    console.error('[extractor] Failed to process exchange:', err);
  }
}
