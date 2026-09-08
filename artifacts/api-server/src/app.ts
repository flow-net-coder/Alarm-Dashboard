import express from 'express';
import cors from 'cors';
import { join } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import apiRouter from './routes';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use('/api', apiRouter);

// Serve React client build in production
const candidatePaths = [
  join(process.cwd(), 'artifacts', 'alarm-dashboard', 'dist', 'public'),
  join(__dirname, '..', '..', 'alarm-dashboard', 'dist', 'public'),
  join(process.cwd(), 'client', 'dist'),
];

const clientDist = candidatePaths.find((p) => existsSync(p));

if (clientDist) {
  console.log(`[marcus] Serving static frontend from ${clientDist}`);
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(join(clientDist, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.json({
      service: 'AI Marcus API',
      status: 'running',
      note: 'Frontend static dist not found.',
      docs: '/api/healthz',
    });
  });
}

export default app;
