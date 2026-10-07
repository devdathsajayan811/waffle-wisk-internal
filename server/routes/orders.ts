import { Router } from 'express';
import { z } from 'zod';
import { db, SqlParam } from '../db/index.js';
import { forbidden, idParam, notFound, parse } from '../lib/http.js';
import { getBusinessTimeZone } from '../lib/settings.js';
import { rangeClause, resolveDateRange } from '../lib/time.js';
import { AuthenticatedRequest, authenticateToken, currentUser, requireRole } from '../middleware/auth.js';
import { checkoutSchema, createOrder, orderLineSchema, paymentMethods, refundOrder } from '../services/orderService.js';

const router = Router();

const createOrderSchema = checkoutSchema.extend({
  items: z.array(orderLineSchema).min(1, 'Order must contain at least one item').max(100),
});

router.post('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const actor = currentUser(req);
  const { items, ...checkout } = parse(createOrderSchema, req.body);
  const result = await db.transaction((tx) => createOrder(tx, actor, items, checkout, { ip: req.ip }));
  return res.status(201).json(result);
});

const listQuerySchema = z.object({
  date_range: z.enum(['today', 'yesterday', '7days', '30days', 'all']).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  payment_method: z.union([z.enum(paymentMethods), z.literal('all')]).optional(),
  status: z.union([z.enum(['COMPLETED', 'HOLD', 'CANCELLED', 'REFUNDED']), z.literal('all')]).optional(),
  staff_id: z.coerce.number().int().positive().optional(),
  search: z.string().trim().max(100).optional(),
});

router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const actor = currentUser(req);
  const query = parse(listQuerySchema, req.query);

  let sql = 'SELECT * FROM orders WHERE 1=1';
  const params: SqlParam[] = [];

  const staffId = actor.role === 'STAFF' ? actor.id : query.staff_id;
  if (staffId) {
    sql += ' AND staff_id = ?';
    params.push(staffId);
  }
  if (query.payment_method && query.payment_method !== 'all') {
    sql += ' AND payment_method = ?';
    params.push(query.payment_method);
  }
  if (query.status && query.status !== 'all') {
    sql += ' AND status = ?';
    params.push(query.status);
  }

  const timeZone = await getBusinessTimeZone(db);
  sql += rangeClause(
    'created_at',
    resolveDateRange(timeZone, { range: query.date_range, startDate: query.start_date, endDate: query.end_date }),
    params
  );

  if (query.search) {
    sql += ' AND (order_number LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)';
    const term = `%${query.search}%`;
    params.push(term, term, term);
  }

  sql += ' ORDER BY created_at DESC, id DESC LIMIT 500';
  return res.json(await db.all(sql, params));
});

router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const actor = currentUser(req);
  const { id } = parse(idParam, req.params);

  const order = await db.get<{ id: number; staff_id: number }>('SELECT * FROM orders WHERE id = ?', [id]);
  if (!order) throw notFound('Order not found');
  if (actor.role === 'STAFF' && order.staff_id !== actor.id) throw forbidden('You can only view your own orders.');

  const items = await db.all('SELECT * FROM order_items WHERE order_id = ?', [id]);
  const receipt = await db.get('SELECT * FROM receipts WHERE order_id = ?', [id]);
  return res.json({ order, items, receipt });
});

router.patch('/:id/refund', authenticateToken, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  const actor = currentUser(req);
  const { id } = parse(idParam, req.params);
  await db.transaction((tx) => refundOrder(tx, actor, id, req.ip));
  return res.json({ message: 'Order refunded successfully and stock restored' });
});

export default router;
