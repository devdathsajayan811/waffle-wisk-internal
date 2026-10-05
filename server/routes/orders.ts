import { Router, Response } from 'express';
import { dbQuery } from '../db.js';
import { AuthenticatedRequest, authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

// Create Order (POS / Staff / Admin)
router.post('/', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const {
    items,
    customer_name,
    customer_phone,
    notes,
    discount,
    payment_method,
    payment_status,
    payment_ref,
    amount_received,
  } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Order must contain at least one item' });
  }

  if (!payment_method) {
    return res.status(400).json({ error: 'Payment method is required' });
  }

  // Calculate order totals
  let subtotal = 0;
  const processedItems: Array<{ id: number; name: string; qty: number; price: number; total: number }> = [];

  for (const item of items) {
    const prod = dbQuery.get('SELECT * FROM products WHERE id = ?', [item.product_id]);
    if (!prod) {
      return res.status(400).json({ error: `Product ID ${item.product_id} not found` });
    }
    const unitPrice = prod.discount_price ? Number(prod.discount_price) : Number(prod.price);
    const itemTotal = unitPrice * Number(item.quantity);
    subtotal += itemTotal;

    processedItems.push({
      id: prod.id,
      name: prod.name,
      qty: Number(item.quantity),
      price: unitPrice,
      total: itemTotal,
    });
  }

  const discountAmount = discount ? Number(discount) : 0;
  const settings = dbQuery.get('SELECT default_gst_percent FROM business_settings WHERE id = 1');
  const taxRate = settings ? Number(settings.default_gst_percent) : 5.0;
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxAmount = Number(((taxableAmount * taxRate) / 100).toFixed(2));
  const grandTotal = Number((taxableAmount + taxAmount).toFixed(2));

  let amountRec = amount_received ? Number(amount_received) : grandTotal;
  let changeReturned = 0;

  if (payment_method === 'CASH') {
    if (amountRec < grandTotal) {
      return res.status(400).json({ error: `Received amount (₹${amountRec}) is less than order total (₹${grandTotal})` });
    }
    changeReturned = Number((amountRec - grandTotal).toFixed(2));
  }

  const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;
  const status = payment_status === 'FAILED' ? 'FAILED' : 'COMPLETED';

  // Insert Order
  const orderRes = dbQuery.run(
    `INSERT INTO orders (order_number, customer_name, customer_phone, notes, subtotal, discount, tax, grand_total, payment_method, payment_status, payment_ref, amount_received, change_returned, staff_id, staff_name, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      orderNumber,
      customer_name ? customer_name.trim() : 'Walk-in Customer',
      customer_phone ? customer_phone.trim() : '',
      notes || '',
      subtotal,
      discountAmount,
      taxAmount,
      grandTotal,
      payment_method,
      payment_status || 'PAID',
      payment_ref || '',
      amountRec,
      changeReturned,
      req.user!.id,
      req.user!.name,
      status,
    ]
  );

  const orderId = orderRes.lastInsertRowid;

  // Insert Order Items & Deduct Product Stock
  for (const pItem of processedItems) {
    dbQuery.run(
      `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total_price)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [orderId, pItem.id, pItem.name, pItem.qty, pItem.price, pItem.total]
    );

    // Deduct stock quantity
    dbQuery.run(
      `UPDATE products SET stock_quantity = MAX(0, stock_quantity - ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [pItem.qty, pItem.id]
    );
  }

  // Create Receipt
  const receiptNumber = `RCP-${Date.now().toString().slice(-6)}`;
  const receiptData = {
    receiptNumber,
    orderNumber,
    date: new Date().toISOString(),
    customerName: customer_name || 'Walk-in Customer',
    customerPhone: customer_phone || '',
    items: processedItems,
    subtotal,
    discount: discountAmount,
    tax: taxAmount,
    grandTotal,
    paymentMethod: payment_method,
    paymentStatus: payment_status || 'PAID',
    staffName: req.user!.name,
    notes,
  };

  dbQuery.run(
    `INSERT INTO receipts (receipt_number, order_id, customer_name, customer_phone, grand_total, payment_method, payment_status, receipt_data_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      receiptNumber,
      orderId,
      customer_name || 'Walk-in Customer',
      customer_phone || '',
      grandTotal,
      payment_method,
      payment_status || 'PAID',
      JSON.stringify(receiptData),
    ]
  );

  // Write Audit Log
  dbQuery.run(
    `INSERT INTO audit_logs (action, user_id, user_name, user_role, description) VALUES (?, ?, ?, ?, ?)`,
    ['CREATE_ORDER', req.user!.id, req.user!.name, req.user!.role, `Created Order #${orderNumber} for ₹${grandTotal} (${payment_method})`]
  );

  const finalOrder = dbQuery.get('SELECT * FROM orders WHERE id = ?', [orderId]);
  const orderItemsList = dbQuery.all('SELECT * FROM order_items WHERE order_id = ?', [orderId]);

  return res.status(201).json({
    order: finalOrder,
    items: orderItemsList,
    receiptNumber,
    receiptData,
  });
});

// Get Order History with filters
router.get('/', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { date_range, start_date, end_date, payment_method, status, staff_id, search } = req.query;

  let sql = `SELECT * FROM orders WHERE 1=1`;
  const params: any[] = [];

  // Staff can only view their own sales if restricted, or all basic orders. Let's allow staff to view orders, but filter by staff if specified.
  if (req.user!.role === 'STAFF' && req.query.own_sales_only === 'true') {
    sql += ` AND staff_id = ?`;
    params.push(req.user!.id);
  } else if (staff_id) {
    sql += ` AND staff_id = ?`;
    params.push(staff_id);
  }

  if (payment_method && payment_method !== 'all') {
    sql += ` AND payment_method = ?`;
    params.push(payment_method);
  }

  if (status && status !== 'all') {
    sql += ` AND status = ?`;
    params.push(status);
  }

  // Date Filtering
  const now = new Date();
  if (date_range === 'today') {
    const todayStr = now.toISOString().slice(0, 10);
    sql += ` AND created_at >= ?`;
    params.push(`${todayStr} 00:00:00`);
  } else if (date_range === 'yesterday') {
    const yest = new Date(now.getTime() - 86400000);
    const yestStr = yest.toISOString().slice(0, 10);
    sql += ` AND created_at >= ? AND created_at <= ?`;
    params.push(`${yestStr} 00:00:00`, `${yestStr} 23:59:59`);
  } else if (date_range === '7days') {
    const d7 = new Date(now.getTime() - 7 * 86400000);
    sql += ` AND created_at >= ?`;
    params.push(d7.toISOString());
  } else if (date_range === '30days') {
    const d30 = new Date(now.getTime() - 30 * 86400000);
    sql += ` AND created_at >= ?`;
    params.push(d30.toISOString());
  } else if (start_date && end_date) {
    sql += ` AND created_at >= ? AND created_at <= ?`;
    params.push(`${start_date} 00:00:00`, `${end_date} 23:59:59`);
  }

  if (search && typeof search === 'string' && search.trim() !== '') {
    sql += ` AND (order_number LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)`;
    const term = `%${search.trim()}%`;
    params.push(term, term, term);
  }

  sql += ` ORDER BY created_at DESC`;

  const orders = dbQuery.all(sql, params);
  return res.json(orders);
});

// Get Single Order details with items & receipt
router.get('/:id', authenticateToken, (req, res) => {
  const order = dbQuery.get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const items = dbQuery.all('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
  const receipt = dbQuery.get('SELECT * FROM receipts WHERE order_id = ?', [order.id]);

  return res.json({
    order,
    items,
    receipt,
  });
});

// Refund Order (Admin Only)
router.patch('/:id/refund', authenticateToken, requireRole('ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  const orderId = Number(req.params.id);
  const order = dbQuery.get('SELECT * FROM orders WHERE id = ?', [orderId]);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  if (order.status === 'REFUNDED') {
    return res.status(400).json({ error: 'Order has already been refunded' });
  }

  // Restore product quantities
  const items = dbQuery.all('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
  for (const item of items) {
    dbQuery.run('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?', [item.quantity, item.product_id]);
  }

  // Update order status
  dbQuery.run(`UPDATE orders SET status = 'REFUNDED', payment_status = 'REFUNDED' WHERE id = ?`, [orderId]);
  dbQuery.run(`UPDATE receipts SET payment_status = 'REFUNDED' WHERE order_id = ?`, [orderId]);

  dbQuery.run(
    `INSERT INTO audit_logs (action, user_id, user_name, user_role, description) VALUES (?, ?, ?, ?, ?)`,
    ['REFUND_ORDER', req.user!.id, req.user!.name, req.user!.role, `Refunded Order #${order.order_number} (Amount: ₹${order.grand_total})`]
  );

  return res.json({ message: 'Order refunded successfully and stock restored' });
});

export default router;
