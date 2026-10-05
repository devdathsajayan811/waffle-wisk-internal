import { Router } from 'express';
import { dbQuery } from '../db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

// Get Audit Logs (Admin Only)
router.get('/', authenticateToken, requireRole('ADMIN'), (req, res) => {
  const { limit, action } = req.query;

  let sql = `SELECT * FROM audit_logs WHERE 1=1`;
  const params: any[] = [];

  if (action && action !== 'all') {
    sql += ` AND action = ?`;
    params.push(action);
  }

  sql += ` ORDER BY created_at DESC LIMIT ?`;
  params.push(limit ? Number(limit) : 100);

  const logs = dbQuery.all(sql, params);
  return res.json(logs);
});

export default router;
