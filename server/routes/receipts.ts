import { Router } from 'express';
import { dbQuery } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// List Receipts with search & filtering
router.get('/', authenticateToken, (req, res) => {
  const { search, start_date, end_date, payment_method } = req.query;

  let sql = `
    SELECT r.*, o.order_number, o.created_at as order_date
    FROM receipts r
    JOIN orders o ON r.order_id = o.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (payment_method && payment_method !== 'all') {
    sql += ` AND r.payment_method = ?`;
    params.push(payment_method);
  }

  if (start_date && end_date) {
    sql += ` AND r.created_at >= ? AND r.created_at <= ?`;
    params.push(`${start_date} 00:00:00`, `${end_date} 23:59:59`);
  }

  if (search && typeof search === 'string' && search.trim() !== '') {
    sql += ` AND (r.receipt_number LIKE ? OR o.order_number LIKE ? OR r.customer_name LIKE ? OR r.customer_phone LIKE ?)`;
    const term = `%${search.trim()}%`;
    params.push(term, term, term, term);
  }

  sql += ` ORDER BY r.created_at DESC`;

  const receipts = dbQuery.all(sql, params);

  // Parse receipt_data_json for front-end rendering
  const formatted = receipts.map((r: any) => ({
    ...r,
    receipt_data: typeof r.receipt_data_json === 'string' ? JSON.parse(r.receipt_data_json) : r.receipt_data_json,
  }));

  return res.json(formatted);
});

// Get Single Receipt
router.get('/:id', authenticateToken, (req, res) => {
  const receipt = dbQuery.get(
    `SELECT r.*, o.order_number, o.created_at as order_date FROM receipts r JOIN orders o ON r.order_id = o.id WHERE r.id = ? OR r.receipt_number = ?`,
    [req.params.id, req.params.id]
  );
  if (!receipt) return res.status(404).json({ error: 'Receipt not found' });

  return res.json({
    ...receipt,
    receipt_data: typeof receipt.receipt_data_json === 'string' ? JSON.parse(receipt.receipt_data_json) : receipt.receipt_data_json,
  });
});

export default router;
