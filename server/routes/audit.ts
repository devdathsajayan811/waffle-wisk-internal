import { Router } from 'express';
import { z } from 'zod';
import { db, SqlParam } from '../db/index.js';
import { parse } from '../lib/http.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

const querySchema = z.object({
  action: z.string().trim().max(50).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

router.get('/', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  const { action, limit } = parse(querySchema, req.query);
  let sql = 'SELECT * FROM audit_logs WHERE 1=1';
  const params: SqlParam[] = [];
  if (action && action !== 'all') {
    sql += ' AND action = ?';
    params.push(action);
  }
  sql += ' ORDER BY created_at DESC, id DESC LIMIT ?';
  params.push(limit ?? 100);
  return res.json(await db.all(sql, params));
});

export default router;
