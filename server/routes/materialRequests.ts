import { Router, Response } from 'express';
import { dbQuery } from '../db.js';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth.js';

const router = Router();

// GET all material requests (Filtered for staff, all for admin)
router.get('/', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

  let requests;
  if (req.user.role === 'ADMIN') {
    requests = dbQuery.all('SELECT * FROM material_requests ORDER BY id DESC');
  } else {
    requests = dbQuery.all('SELECT * FROM material_requests WHERE staff_id = ? ORDER BY id DESC', [req.user.id]);
  }

  return res.json(requests);
});

// POST create material request (Staff or Admin)
router.post('/', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

  const { material, quantity, unit, note } = req.body;

  if (!material || !quantity || !unit) {
    return res.status(400).json({ error: 'Material name, quantity, and unit are required.' });
  }

  const result = dbQuery.run(
    `INSERT INTO material_requests (staff_id, staff_name, material, quantity, unit, note, status)
     VALUES (?, ?, ?, ?, ?, ?, 'Pending')`,
    [req.user.id, req.user.name, material.trim(), Number(quantity), unit.trim(), note ? note.trim() : '']
  );

  const newRequest = dbQuery.get('SELECT * FROM material_requests WHERE id = ?', [result.lastInsertRowid]);
  return res.status(201).json(newRequest);
});

// PATCH update status (Admin only)
router.patch('/:id/status', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

  const { id } = req.params;
  const { status } = req.body;

  if (!['Pending', 'Approved', 'Completed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }

  const existing = dbQuery.get('SELECT * FROM material_requests WHERE id = ?', [id]);
  if (!existing) {
    return res.status(404).json({ error: 'Material request not found' });
  }

  dbQuery.run('UPDATE material_requests SET status = ? WHERE id = ?', [status, id]);
  const updated = dbQuery.get('SELECT * FROM material_requests WHERE id = ?', [id]);

  return res.json({ message: 'Status updated successfully', request: updated });
});

export default router;
