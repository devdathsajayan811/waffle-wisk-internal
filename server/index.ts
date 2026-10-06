import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

import { initDb } from './db.js';
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import inventoryRoutes from './routes/inventory.js';
import orderRoutes from './routes/orders.js';
import receiptRoutes from './routes/receipts.js';
import userRoutes from './routes/users.js';
import reportRoutes from './routes/reports.js';
import settingsRoutes from './routes/settings.js';
import auditRoutes from './routes/audit.js';
import statusRoutes from './routes/status.js';
import materialRequestsRoutes from './routes/materialRequests.js';
import cartsRoutes from './routes/carts.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static uploads
const uploadsPath = path.resolve(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsPath));

// Ensure DB is initialized before handling requests
let dbInitPromise: Promise<void> | null = null;
app.use(async (_req, res, next) => {
  if (!dbInitPromise) {
    dbInitPromise = initDb().catch((err) => {
      console.error('Database init error:', err);
      dbInitPromise = null;
      throw err;
    });
  }
  try {
    await dbInitPromise;
    next();
  } catch (err: any) {
    res.status(500).json({ error: `Database initialization failed: ${err?.message || err}` });
  }
});

// Register API Routes
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

// Root Health endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Global JSON error handler (ensures Express never returns HTML error pages for API routes)
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Express API Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

// Standalone local server listener
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  initDb().then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Waffle Wisk Server running on http://localhost:${PORT}`);
    });
  }).catch((err) => {
    console.error('Failed to initialize database:', err);
  });
}

export default app;
