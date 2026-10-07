import { Router } from 'express';
import { z } from 'zod';
import { db, Row, SqlParam } from '../db/index.js';
import { forbidden, notFound, parse } from '../lib/http.js';
import { getBusinessTimeZone } from '../lib/settings.js';
import { rangeClause, resolveDateRange } from '../lib/time.js';
import { AuthenticatedRequest, authenticateToken, currentUser } from '../middleware/auth.js';
import { paymentMethods } from '../services/orderService.js';

const router = Router();

const withParsedData = (receipt: Row) => ({
  ...receipt,
  receipt_data: typeof receipt.receipt_data_json === 'string' ? JSON.parse(receipt.receipt_data_json) : null,
});

const listQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  payment_method: z.union([z.enum(paymentMethods), z.literal('all')]).optional(),
});

router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const actor = currentUser(req);
  const query = parse(listQuerySchema, req.query);

  let sql = `SELECT r.*, o.order_number, o.created_at AS order_date
    FROM receipts r JOIN orders o ON r.order_id = o.id WHERE 1=1`;
  const params: SqlParam[] = [];

  if (actor.role === 'STAFF') {
    sql += ' AND o.staff_id = ?';
    params.push(actor.id);
  }
  if (query.payment_method && query.payment_method !== 'all') {
    sql += ' AND r.payment_method = ?';
    params.push(query.payment_method);
  }
  const timeZone = await getBusinessTimeZone(db);
  sql += rangeClause('r.created_at', resolveDateRange(timeZone, { startDate: query.start_date, endDate: query.end_date }), params);
  if (query.search) {
    sql += ' AND (r.receipt_number LIKE ? OR o.order_number LIKE ? OR r.customer_name LIKE ? OR r.customer_phone LIKE ?)';
    const term = `%${query.search}%`;
    params.push(term, term, term, term);
  }
  sql += ' ORDER BY r.created_at DESC, r.id DESC LIMIT 500';

  return res.json((await db.all(sql, params)).map(withParsedData));
});

router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const actor = currentUser(req);
  const { id } = parse(z.object({ id: z.string().trim().min(1).max(50) }), req.params);

  const receipt = await db.get(
    `SELECT r.*, o.order_number, o.created_at AS order_date, o.staff_id
     FROM receipts r JOIN orders o ON r.order_id = o.id
     WHERE r.id = ? OR r.receipt_number = ?`,
    [Number(id) || -1, id]
  );
  if (!receipt) throw notFound('Receipt not found');
  if (actor.role === 'STAFF' && receipt.staff_id !== actor.id) throw forbidden('You can only view your own receipts.');

  return res.json(withParsedData(receipt));
});

export default router;
