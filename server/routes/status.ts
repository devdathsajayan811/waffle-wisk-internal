import { Router } from 'express';
import { getDatabase } from '../db/index.js';

const router = Router();
const startTime = Date.now();

router.get('/', async (_req, res) => {
  let databaseStatus: 'Connected' | 'Error' = 'Error';
  let databaseDurable = false;
  try {
    const database = await getDatabase();
    const row = await database.get<{ alive: number }>('SELECT 1 AS alive');
    if (row?.alive === 1) databaseStatus = 'Connected';
    databaseDurable = database.durable;
  } catch {
    databaseStatus = 'Error';
  }

  return res.json({
    internetStatus: 'Connected',
    databaseStatus,
    databaseDurable,
    serverStatus: 'Online',
    lastSyncTime: new Date().toISOString(),
    applicationHealth: databaseStatus !== 'Connected' ? 'Error' : databaseDurable ? 'Healthy' : 'Warning',
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
  });
});

export default router;
