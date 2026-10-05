import { Router } from 'express';
import { dbQuery } from '../db.js';

const router = Router();

const startTime = Date.now();

// System Connectivity & Health Check
router.get('/', (_req, res) => {
  let dbStatus = 'Disconnected';
  try {
    const test = dbQuery.get('SELECT 1 as alive');
    if (test && test.alive === 1) {
      dbStatus = 'Connected';
    }
  } catch (err) {
    dbStatus = 'Error';
  }

  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

  return res.json({
    internetStatus: 'Connected', // Browser/Client will combine with window.navigator.onLine
    databaseStatus: dbStatus,
    serverStatus: 'Online',
    lastSyncTime: new Date().toISOString(),
    applicationHealth: dbStatus === 'Connected' ? 'Healthy' : 'Warning',
    uptimeSeconds,
  });
});

export default router;
