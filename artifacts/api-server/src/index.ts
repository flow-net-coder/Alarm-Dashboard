import 'dotenv/config';
import app from './app';
import cron from 'node-cron';
import { ensureTablesExist } from './db';
import { runHeartbeat } from './lib/heartbeat';
import { generateMarkdownFiles } from './lib/markdown';

const PORT = parseInt(process.env.PORT ?? '5000', 10);

app.listen(PORT, async () => {
  console.log(`[marcus] API server running on port ${PORT}`);
  console.log(`[marcus] Marcus name: ${process.env.MANAGER_NAME ?? 'Marcus'}`);
  console.log(`[marcus] OpenRouter model: ${process.env.OPENROUTER_MODEL ?? 'openrouter/free'}`);

  // Automatically ensure DB tables are created on start
  await ensureTablesExist();

  // Generate initial .md files on startup
  try {
    await generateMarkdownFiles();
    console.log('[marcus] Initial .md files generated in marcus-state/');
  } catch (err) {
    console.warn('[marcus] Could not generate initial .md files:', (err as Error).message);
  }

  // Schedule hourly heartbeat
  cron.schedule('0 * * * *', async () => {
    console.log('[heartbeat] Scheduled run triggered');
    try {
      await runHeartbeat();
    } catch (err) {
      console.error('[heartbeat] Scheduled run failed:', err);
    }
  });

  console.log('[marcus] Heartbeat scheduled: every hour at :00');
});
