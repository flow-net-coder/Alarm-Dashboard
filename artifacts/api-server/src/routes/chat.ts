import { Router } from 'express';
import { db, conversationsTable } from '../db';
import { desc } from 'drizzle-orm';
import { generateMarcusResponse } from '../lib/openrouter';
import { buildSystemPrompt, getRecentHistory, saveMessages } from '../lib/memory';
import { processExchange } from '../lib/extractor';

const router = Router();

/**
 * POST /api/chat
 * Send a message to the marcus and get a response.
 */
router.post('/chat', async (req, res): Promise<void> => {
  const { message } = req.body as { message?: string };

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  const userContent = message.trim();

  try {
    // Build context: system prompt + conversation history
    const [systemPrompt, history] = await Promise.all([
      buildSystemPrompt(),
      getRecentHistory(),
    ]);

    // Add the new user message to history
    const messages = [...history, { role: 'user' as const, content: userContent }];

    // Generate marcus response
    const reply = await generateMarcusResponse(messages, systemPrompt);

    // Save both messages to DB
    const { userId } = await saveMessages(userContent, reply);

    // Fire-and-forget: extract action items + context updates in background
    processExchange(userContent, reply, userId).catch((err) =>
      console.error('[chat] Background extraction failed:', err),
    );

    res.json({ reply, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('[chat] Error generating response:', err);
    res.status(500).json({ error: 'Failed to generate marcus response. Check your OPENROUTER_API_KEY.' });
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
