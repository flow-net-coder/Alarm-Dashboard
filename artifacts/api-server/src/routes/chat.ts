import { Router } from 'express';
import { db, conversationsTable } from '../db';
import { desc } from 'drizzle-orm';
import { generateMarcusResponse } from '../lib/openrouter';
import { buildSystemPrompt, getRecentHistory, saveMessages } from '../lib/memory';
import { processExchange } from '../lib/extractor';
import { buildClientContextBlock, searchWebForMarcus, type AssistantClientContext } from '../lib/serper';

const router = Router();

/**
 * POST /api/chat
 * Send a message to the marcus and get a response.
 */
router.post('/chat', async (req, res): Promise<void> => {
  const { message, context } = req.body as { message?: string; context?: AssistantClientContext };

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  const userContent = message.trim();

  try {
    // Build context: system prompt + conversation history
    const [systemPrompt, history, webContext] = await Promise.all([
      buildSystemPrompt(),
      getRecentHistory(),
      searchWebForMarcus(userContent, context).catch((error) => {
        console.error('[chat] Serper search failed:', error);
        return '';
      }),
    ]);
    const clientContext = buildClientContextBlock(context);
    const enrichedSystemPrompt = [systemPrompt, clientContext, webContext].filter(Boolean).join('\n\n');

    // Add the new user message to history
    const messages = [...history, { role: 'user' as const, content: userContent }];

    // Generate marcus response
    const reply = await generateMarcusResponse(messages, enrichedSystemPrompt);

    // Save both messages to DB
    const { userId } = await saveMessages(
      userContent,
      reply,
      context ? { clientContext: context, webContextUsed: Boolean(webContext) } : undefined,
    );

    // Fire-and-forget: extract action items + context updates in background
    processExchange(userContent, reply, userId).catch((err) =>
      console.error('[chat] Background extraction failed:', err),
    );

    res.json({ reply, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('[chat] Error generating response:', err);
    res.status(500).json({ error: (err as Error).message || 'Failed to generate Marcus response.' });
  }
});

/**
 * GET /api/chat/history
 * Retrieve conversation history (most recent first).
 */
router.get('/chat/history', async (req, res): Promise<void> => {
  const limit = Math.min(parseInt((req.query['limit'] as string) ?? '50', 10), 200);

  const rows = await db
    .select()
    .from(conversationsTable)
    .orderBy(desc(conversationsTable.createdAt))
    .limit(limit);

  res.json({ messages: rows.reverse() });
});

export default router;
