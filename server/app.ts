import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { getDatabase } from './db/index.js';
import { HttpError } from './lib/http.js';
import { dbTimestampToIso } from './lib/time.js';

import auditRoutes from './routes/audit.js';
import authRoutes from './routes/auth.js';
import cartsRoutes from './routes/carts.js';
import inventoryRoutes from './routes/inventory.js';
import materialRequestsRoutes from './routes/materialRequests.js';
import orderRoutes from './routes/orders.js';
import productRoutes from './routes/products.js';
import receiptRoutes from './routes/receipts.js';
import reportRoutes from './routes/reports.js';
import settingsRoutes from './routes/settings.js';
import statusRoutes from './routes/status.js';
import userRoutes from './routes/users.js';

export const app = express();

app.set('trust proxy', 1);
// Stored timestamps are UTC without a zone marker; emit them as ISO-8601 with Z.
app.set('json replacer', (_key: string, value: unknown) => (typeof value === 'string' ? dbTimestampToIso(value) : value));

app.use(helmet());
if (config.corsOrigins.length > 0) {
  app.use(cors({ origin: config.corsOrigins }));
}
app.use(express.json({ limit: '100kb' }));

if (!config.isVercel) {
  app.use('/uploads', express.static(config.uploadsDir));
}

app.use(async (_req, _res, next) => {
  await getDatabase();
  next();
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.loginRateLimit,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/receipts', receiptRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/material-requests', materialRequestsRoutes);
app.use('/api/carts', cartsRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 5 MB or smaller' : err.message;
    return res.status(400).json({ error: message });
  }

  const message = String(err?.message ?? '');
  if (message.includes('UNIQUE constraint failed')) {
    return res.status(409).json({ error: 'A record with the same unique value already exists' });
  }
  if (message.includes('FOREIGN KEY constraint failed')) {
    return res.status(400).json({ error: 'A referenced record does not exist' });
  }
  // Errors raised by body-parser and similar middleware carry a client status.
  if (typeof err?.status === 'number' && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: err.expose ? message : 'Bad request' });
  }

  console.error('Unhandled API error:', err);
  return res.status(500).json({ error: config.isProduction ? 'Internal Server Error' : message || 'Internal Server Error' });
});

export default app;
