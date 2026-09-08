import { Router } from 'express';
import chatRouter from './chat';
import actionsRouter from './actions';
import marcusRouter from './marcus';
import heartbeatRouter from './heartbeat';
import pushRouter from './push';

const router = Router();


router.use(chatRouter);
router.use(actionsRouter);
router.use(marcusRouter);
router.use(heartbeatRouter);
router.use(pushRouter);

export default router;
