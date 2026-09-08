import { Router } from 'express';
import { db, marcusContextTable, heartbeatLogsTable } from '../db';
import { eq, desc } from 'drizzle-orm';
import { getMarcusContext, updateMarcusContext } from '../lib/memory';
import { readFile } from 'fs/promises';
import { join } from 'path';

const router = Router();
const STATE_DIR = process.env.MANAGER_STATE_DIR ?? join(process.cwd(), 'marcus-state');

/**
 * GET /api/marcus
 * Get the marcus's current state: context, name, last heartbeat.
 */
router.get('/marcus', async (_req, res): Promise<void> => {
  const [context, lastHeartbeat] = await Promise.all([
    getMarcusContext(),
    db
      .select()
      .from(heartbeatLogsTable)
      .orderBy(desc(heartbeatLogsTable.ranAt))
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ]);

  res.json({
    name: process.env.MANAGER_NAME ?? 'Marcus',
    context,
    lastHeartbeat,
  });
});

/**
 * PUT /api/marcus/context
 * Update marcus context directly (e.g., set user_name, company_name on setup).
 */
router.put('/marcus/context', async (req, res): Promise<void> => {
  const updates = req.body as Record<string, string>;

  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    res.status(400).json({ error: 'Body must be a flat key-value object of strings' });
    return;
  }

  await updateMarcusContext(updates);
  const context = await getMarcusContext();
  res.json({ context });
});

/**
 * GET /api/marcus/files/:filename
 * Serve the generated .md state files.
 * filename: MANAGER | ACTIONS | CALENDAR
 */
router.get('/marcus/files/:filename', async (req, res): Promise<void> => {
  const allowed = ['MANAGER', 'ACTIONS', 'CALENDAR'];
  const filename = (Array.isArray(req.params['filename'])
    ? req.params['filename'][0]
    : req.params['filename'] ?? '').toUpperCase();

  if (!allowed.includes(filename)) {
    res.status(400).json({ error: `filename must be one of: ${allowed.join(', ')}` });
    return;
  }

  try {
    const content = await readFile(join(STATE_DIR, `${filename}.md`), 'utf-8');
    res.type('text/markdown').send(content);
  } catch {
    res.status(404).json({ error: `${filename}.md not found. Run a heartbeat first.` });
  }
});

/**
 * GET /api/marcus/heartbeats
 * Get heartbeat history.
 */
router.get('/marcus/heartbeats', async (_req, res): Promise<void> => {
  const logs = await db
    .select()
    .from(heartbeatLogsTable)
    .orderBy(desc(heartbeatLogsTable.ranAt))
    .limit(20);

  res.json({ heartbeats: logs });
});

export default router;
