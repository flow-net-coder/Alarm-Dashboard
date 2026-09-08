import { Router } from 'express';
import { runHeartbeat } from '../lib/heartbeat';

const router = Router();

router.get('/healthz', (_req, res) => {
  res.json({ ok: true, service: 'buzzer-api' });
});

/**
 * POST /api/heartbeat
 * Manually trigger a heartbeat (also runs automatically every hour).
 * Useful for testing or forcing a state refresh.
 */
router.post('/heartbeat', async (_req, res): Promise<void> => {
  try {
    const result = await runHeartbeat();
    res.json({ ...result, ranAt: new Date().toISOString() });
  } catch (err) {
    console.error('[heartbeat route] Error:', err);
    res.status(500).json({ error: 'Heartbeat failed. Check server logs.' });
  }
});

export default router;
