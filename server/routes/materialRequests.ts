import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { audit } from '../lib/audit.js';
import { badRequest, idParam, notFound, optionalString, parse } from '../lib/http.js';
import { AuthenticatedRequest, authenticateToken, currentUser, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const actor = currentUser(req);
  const requests =
    actor.role === 'ADMIN'
      ? await db.all('SELECT * FROM material_requests ORDER BY id DESC')
      : await db.all('SELECT * FROM material_requests WHERE staff_id = ? ORDER BY id DESC', [actor.id]);
  return res.json(requests);
});

const createSchema = z.object({
  material: z.string().trim().min(1, 'Material name is required').max(150),
  quantity: z.coerce.number().positive('Quantity must be greater than zero'),
  unit: z.string().trim().min(1, 'Unit is required').max(30),
  note: optionalString(500),
  cart_id: z.preprocess((v) => (v === '' || v === null ? undefined : v), z.coerce.number().int().positive().optional()),
});

router.post('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const actor = currentUser(req);
  const data = parse(createSchema, req.body);

  let cartNumber: string | null = null;
  if (data.cart_id) {
    const cart = await db.get<{ cart_number: string; staff_id: number }>('SELECT cart_number, staff_id FROM carts WHERE id = ?', [
      data.cart_id,
    ]);
    if (!cart || (actor.role === 'STAFF' && cart.staff_id !== actor.id)) throw badRequest('Unknown cart');
    cartNumber = cart.cart_number;
  }

  const { lastInsertRowid } = await db.run(
    `INSERT INTO material_requests (staff_id, staff_name, cart_id, cart_number, material, quantity, unit, note, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending')`,
    [actor.id, actor.name, data.cart_id ?? null, cartNumber, data.material, data.quantity, data.unit, data.note ?? '']
  );
  return res.status(201).json(await db.get('SELECT * FROM material_requests WHERE id = ?', [lastInsertRowid]));
});

router.patch('/:id/status', authenticateToken, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  const actor = currentUser(req);
  const { id } = parse(idParam, req.params);
  const { status } = parse(z.object({ status: z.enum(['Pending', 'Approved', 'Completed']) }), req.body);

  const updated = await db.transaction(async (tx) => {
    const existing = await tx.get<{ material: string; staff_name: string }>('SELECT * FROM material_requests WHERE id = ?', [id]);
    if (!existing) throw notFound('Material request not found');
    await tx.run('UPDATE material_requests SET status = ? WHERE id = ?', [status, id]);
    await audit(tx, actor, 'MATERIAL_REQUEST_STATUS', `Marked ${existing.material} request from ${existing.staff_name} as ${status}`, req.ip);
    return tx.get('SELECT * FROM material_requests WHERE id = ?', [id]);
  });

  return res.json({ message: 'Status updated successfully', request: updated });
});

export default router;
