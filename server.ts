import express from 'express';
import path from 'node:path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { createInitializedD1Database } from './server/d1SqliteAdapter';
import { handleWorkerRequest } from './worker/index';
import { WorkerEnv } from './worker/types';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Инициализация локальной SQLite базы данных по схеме Cloudflare D1 (migrations/0001_init.sql)
  const dbFile = path.resolve(process.cwd(), '.lea-local-d1.sqlite');
  const d1Database = createInitializedD1Database(dbFile);

  const workerEnv: WorkerEnv = {
    DB: d1Database,
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || '',
    ALLOWED_ORIGIN: process.env.ALLOWED_ORIGIN || '*',
    SALON_TIMEZONE: process.env.SALON_TIMEZONE || 'Europe/Moscow',
  };

  // Проксируем все запросы /api/* и /lea-booking-api/api/* напрямую в обработчик Cloudflare Worker
  app.use(
    ['/api', '/lea-booking-api/api'],
    express.raw({ type: '*/*', limit: '1mb' }),
    async (req, res) => {
      try {
        const protocol = req.protocol || 'http';
        const host = req.get('host') || `localhost:${PORT}`;
        const normalizedOriginalUrl = req.originalUrl.replace(/^\/lea-booking-api\/api/, '/api');
        const fullUrl = `${protocol}://${host}${normalizedOriginalUrl}`;

        const headers = new Headers();
        for (const [key, value] of Object.entries(req.headers)) {
          if (typeof value === 'string') {
            headers.set(key, value);
          } else if (Array.isArray(value)) {
            headers.set(key, value.join(', '));
          }
        }

        const hasBody = req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS';
        const bodyBytes =
          hasBody && Buffer.isBuffer(req.body) && req.body.length > 0
            ? new Uint8Array(req.body)
            : undefined;

        const workerReq = new Request(fullUrl, {
          method: req.method,
          headers,
          body: bodyBytes,
        });

        const workerRes = await handleWorkerRequest(workerReq, workerEnv);

        res.status(workerRes.status);
        workerRes.headers.forEach((val, key) => {
          res.setHeader(key, val);
        });

        const responseText = await workerRes.text();
        res.send(responseText);
      } catch (error) {
        console.error('Error handling /api request:', error);
        res.status(503).json({
          ok: false,
          code: 'SERVICE_UNAVAILABLE',
          error: 'Временная ошибка сервера.',
        });
      }
    }
  );

  // Раздаём собранную production-папку dist также по префиксу /lea-booking-api (эмуляция GitHub Pages)
  const distPath = path.resolve(process.cwd(), 'dist');
  app.use('/lea-booking-api', express.static(distPath));

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LÉA Studio server & D1 API running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
