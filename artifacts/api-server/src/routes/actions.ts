import { Router } from 'express';
import { db, actionItemsTable } from '../db';
import { eq, desc } from 'drizzle-orm';

const router = Router();

/**
 * GET /api/actions
 * List action items. Filter by status via ?status=pending|in_progress|done|cancelled
 * This endpoint is designed for the connecting application to poll and act on.
 */
router.get('/actions', async (req, res): Promise<void> => {
  const status = req.query['status'] as string | undefined;
  const limit = Math.min(parseInt((req.query['limit'] as string) ?? '50', 10), 200);

  const validStatuses = ['pending', 'in_progress', 'done', 'cancelled'];

  const rows = await db
    .select()
    .from(actionItemsTable)
    .where(status && validStatuses.includes(status) ? eq(actionItemsTable.status, status) : undefined)
    .orderBy(desc(actionItemsTable.createdAt))
    .limit(limit);

  res.json({ actions: rows, total: rows.length });
});

/**
 * GET /api/actions/:id
 * Get a single action item.
 */
router.get('/actions/:id', async (req, res): Promise<void> => {
  const id = Array.isArray(req.params['id']) ? req.params['id'][0] : req.params['id'];

  const [action] = await db
    .select()
    .from(actionItemsTable)
    .where(eq(actionItemsTable.id, id!));

  if (!action) {
    res.status(404).json({ error: 'Action item not found' });
    return;
  }

  res.json(action);
});

/**
 * PATCH /api/actions/:id
 * Update an action item's status or details.
 * Used by the connecting application to mark items in_progress, done, or cancelled.
 */
router.patch('/actions/:id', async (req, res): Promise<void> => {
  const id = Array.isArray(req.params['id']) ? req.params['id'][0] : req.params['id'];
  const { status, details } = req.body as { status?: string; details?: Record<string, unknown> };

  const validStatuses = ['pending', 'in_progress', 'done', 'cancelled'];

  if (status && !validStatuses.includes(status)) {
    res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    return;
  }

  const updates: Partial<{ status: string; details: Record<string, unknown> }> = {};
  if (status) updates.status = status;
  if (details) updates.details = details;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: 'Provide at least one field to update: status, details' });
    return;
  }

  const [updated] = await db
    .update(actionItemsTable)
    .set(updates)
    .where(eq(actionItemsTable.id, id!))
    .returning();

  if (!updated) {
    res.status(404).json({ error: 'Action item not found' });
    return;
  }

  res.json(updated);
});

/**
 * DELETE /api/actions/:id
 * Remove an action item.
 */
router.delete('/actions/:id', async (req, res): Promise<void> => {
  const id = Array.isArray(req.params['id']) ? req.params['id'][0] : req.params['id'];

  const [deleted] = await db
    .delete(actionItemsTable)
    .where(eq(actionItemsTable.id, id!))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: 'Action item not found' });
    return;
  }

  res.sendStatus(204);
});

export default router;
