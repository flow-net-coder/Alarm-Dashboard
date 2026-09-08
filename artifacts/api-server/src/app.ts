import express from 'express';
import cors from 'cors';
import { join } from 'path';
import { existsSync } from 'fs';
import apiRouter from './routes';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use('/api', apiRouter);

// Serve React client build in production
const clientDist = join(process.cwd(), 'client', 'dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('/{*splat}', (_req, res) => {
    res.sendFile(join(clientDist, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.json({
      service: 'AI Marcus API',
      status: 'running',
      note: 'Run "npm run build:client" to serve the chat UI, or start the client dev server separately.',
      docs: '/api/healthz',
    });
  });
}

export default app;
