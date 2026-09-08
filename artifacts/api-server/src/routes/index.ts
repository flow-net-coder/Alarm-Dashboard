import { Router } from 'express';
import chatRouter from './chat';
import actionsRouter from './actions';
import marcusRouter from './marcus';
import heartbeatRouter from './heartbeat';

const router = Router();

router.get('/healthz', (_req, res) => res.json({ status: 'ok', service: 'marcus-api' }));

router.use(chatRouter);
router.use(actionsRouter);
router.use(marcusRouter);
router.use(heartbeatRouter);

export default router;
