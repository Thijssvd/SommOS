'use strict';
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const pino = require('pino');
const pinoHttp = require('pino-http');

const routes = require('./api/routes');
const { getDbStatus } = require('./database/connection');

const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;
const ORIGIN = process.env.CORS_ORIGIN || false;
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
const logger = pino({ level: process.env.LOG_LEVEL || 'info', redact: ['req.headers.authorization'] });

function createApp() {
  const app = express();
  if (TRUST_PROXY) app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(pinoHttp({ logger }));

  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "img-src": ["'self'", "data:"],
        "connect-src": ["'self'"],
        "object-src": ["'none'"],
        "frame-ancestors": ["'none'"]
      }
    },
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'no-referrer' },
    crossOriginResourcePolicy: { policy: 'same-site' }
  }));

  app.use(express.json({ limit: '512kb' }));
  app.use(cors({ origin: ORIGIN, credentials: true }));

  const limiter = rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false });
  app.use('/api', limiter);

  // Health and readiness
  app.get('/health', (_req, res) => res.json({ ok: true, service: 'sommOS', ts: Date.now() }));
  app.get('/ready', async (_req, res) => {
    const status = await getDbStatus().catch(() => ({ ok: false }));
    res.status(status.ok ? 200 : 503).json({ ready: status.ok, db: status, ts: Date.now() });
  });

  // Static frontend
  const staticDir = path.join(__dirname, '..', 'frontend');
  app.use(express.static(staticDir, { index: 'index.html', fallthrough: true }));

  // API
  app.use('/api', routes);

  // 404
  app.use((req, res) => res.status(404).json({ error: 'Not Found' }));

  // Error handler
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const status = err.statusCode || 500;
    const body = { error: err.message || 'Internal Server Error' };
    if (process.env.NODE_ENV !== 'production' && err.stack) body.stack = err.stack;
    res.status(status).json(body);
  });

  return app;
}

if (require.main === module) {
  const app = createApp();
  const server = app.listen(PORT, () => logger.info({ msg: 'listening', port: PORT }));
  const shutdown = (sig) => () => {
    logger.info({ msg: 'shutdown', sig });
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000);
  };
  process.on('SIGINT', shutdown('SIGINT'));
  process.on('SIGTERM', shutdown('SIGTERM'));
}

module.exports = { createApp };
