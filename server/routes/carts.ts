import { Router, Response } from 'express';
import { dbQuery } from '../db.js';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth.js';

const router = Router();

// GET all carts (Filtered by status, staff assignment)
router.get('/', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

  const { status, own_carts_only } = req.query;

  let sql = `SELECT * FROM carts WHERE 1=1`;
  const params: any[] = [];

  if (req.user.role === 'STAFF' || own_carts_only === 'true') {
    sql += ` AND staff_id = ?`;
    params.push(req.user.id);
  }

  if (status && status !== 'all') {
    sql += ` AND status = ?`;
    params.push(status);
  }

  sql += ` ORDER BY id DESC`;

  const carts = dbQuery.all(sql, params);

  // Attach items to each cart
  const cartsWithItems = carts.map((cart) => {
    const items = dbQuery.all('SELECT * FROM cart_items WHERE cart_id = ?', [cart.id]);
    const itemCount = items.reduce((acc: number, item: any) => acc + item.quantity, 0);
    return {
      ...cart,
      items,
      itemCount,
    };
  });

  return res.json(cartsWithItems);
});

// GET stats for dashboard
router.get('/stats/today', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

  const todayStr = new Date().toISOString().slice(0, 10);
  let baseSql = `WHERE created_at >= ?`;
  const baseParams: any[] = [`${todayStr} 00:00:00`];

  if (req.user.role === 'STAFF') {
    baseSql += ` AND staff_id = ?`;
    baseParams.push(req.user.id);
  }

  const activeRes = dbQuery.get(`SELECT COUNT(*) as count FROM carts ${baseSql} AND status = 'ACTIVE'`, baseParams);
  const activeCount = activeRes ? Number(activeRes.count) : 0;

  const completedRes = dbQuery.get(`SELECT COUNT(*)` + ` as count, SUM(total) as totalSum FROM carts ${baseSql} AND status = 'COMPLETED'`, baseParams);
  const completedCount = completedRes ? Number(completedRes.count) : 0;
  const totalSum = completedRes && completedRes.totalSum ? Number(completedRes.totalSum) : 0;

  return res.json({
    activeCarts: activeCount,
    completedCarts: completedCount,
    todayTotal: totalSum,
  });
});

// POST create new independent cart
router.post('/', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

  const { customer_name } = req.body;

  // Generate cart number CART-XXXX
  const cartNumber = `CART-${Date.now().toString().slice(-6)}`;

  const result = dbQuery.run(
    `INSERT INTO carts (cart_number, staff_id, staff_name, customer_name, status, total)
     VALUES (?, ?, ?, ?, 'ACTIVE', 0)`,
    [cartNumber, req.user.id, req.user.name, customer_name ? customer_name.trim() : 'Walk-in Customer']
  );

  const cartId = result.lastInsertRowid;
  const newCart = dbQuery.get('SELECT * FROM carts WHERE id = ?', [cartId]);

  return res.status(201).json({
    ...newCart,
    items: [],
    itemCount: 0,
  });
});

// GET single cart details
router.get('/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const cart = dbQuery.get('SELECT * FROM carts WHERE id = ?', [req.params.id]);
  if (!cart) return res.status(404).json({ error: 'Cart not found' });

  if (req.user!.role === 'STAFF' && cart.staff_id !== req.user!.id) {
    return res.status(403).json({ error: 'Access denied: You can only access your assigned carts.' });
  }

  const items = dbQuery.all('SELECT * FROM cart_items WHERE cart_id = ?', [cart.id]);
  const receipt = dbQuery.get('SELECT * FROM receipts WHERE order_id = ?', [cart.id]);

  return res.json({
    ...cart,
    items,
    itemCount: items.reduce((acc: number, i: any) => acc + i.quantity, 0),
    receipt,
  });
});

// PUT update items in active cart (Enforces Price Snapshot)
router.put('/:id/items', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

  const cartId = Number(req.params.id);
  const cart = dbQuery.get('SELECT * FROM carts WHERE id = ?', [cartId]);

  if (!cart) return res.status(404).json({ error: 'Cart not found' });
  if (cart.status !== 'ACTIVE') {
    return res.status(400).json({ error: 'Cannot modify a completed or cancelled cart.' });
  }

  if (req.user.role === 'STAFF' && cart.staff_id !== req.user.id) {
    return res.status(403).json({ error: 'Access denied: Cannot edit another staff member cart.' });
  }

  const { items } = req.body; // Array<{ product_id: number, quantity: number }>
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'Items array is required' });
  }

  // Get existing snapshots in cart_items to preserve price_snapshot for already added items!
  const existingItems = dbQuery.all('SELECT * FROM cart_items WHERE cart_id = ?', [cartId]);
  const snapshotMap = new Map<number, { name: string; price: number }>();
  existingItems.forEach((item: any) => {
    snapshotMap.set(item.product_id, {
      name: item.item_name_snapshot,
      price: item.price_snapshot,
    });
  });

  // Clear existing items in cart
  dbQuery.run('DELETE FROM cart_items WHERE cart_id = ?', [cartId]);

  let newTotal = 0;
  for (const itemPayload of items) {
    const qty = Number(itemPayload.quantity);
    if (qty <= 0) continue;

    let itemName: string;
    let unitPrice: number;

    if (snapshotMap.has(itemPayload.product_id)) {
      // PRESERVE SNAPSHOT PRICE
      const snap = snapshotMap.get(itemPayload.product_id)!;
      itemName = snap.name;
      unitPrice = snap.price;
    } else {
      // READ CURRENT MASTER PRICE FOR NEW ITEM AT ADDITION TIME
      const prod = dbQuery.get('SELECT * FROM products WHERE id = ?', [itemPayload.product_id]);
      if (!prod) continue;
      itemName = prod.name;
      unitPrice = prod.discount_price ? Number(prod.discount_price) : Number(prod.price);
    }

    const subtotal = Number((unitPrice * qty).toFixed(2));
    newTotal += subtotal;

    dbQuery.run(
      `INSERT INTO cart_items (cart_id, product_id, item_name_snapshot, price_snapshot, quantity, subtotal)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [cartId, itemPayload.product_id, itemName, unitPrice, qty, subtotal]
    );
  }

  newTotal = Number(newTotal.toFixed(2));
  dbQuery.run('UPDATE carts SET total = ? WHERE id = ?', [newTotal, cartId]);

  const updatedCart = dbQuery.get('SELECT * FROM carts WHERE id = ?', [cartId]);
  const updatedItems = dbQuery.all('SELECT * FROM cart_items WHERE cart_id = ?', [cartId]);

  return res.json({
    ...updatedCart,
    items: updatedItems,
    itemCount: updatedItems.reduce((acc: number, i: any) => acc + i.quantity, 0),
  });
});

// POST complete cart & generate receipt
router.post('/:id/complete', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

  const cartId = Number(req.params.id);
  const cart = dbQuery.get('SELECT * FROM carts WHERE id = ?', [cartId]);

  if (!cart) return res.status(404).json({ error: 'Cart not found' });
  if (cart.status !== 'ACTIVE') {
    return res.status(400).json({ error: 'Cart is already completed or cancelled.' });
  }

  const items = dbQuery.all('SELECT * FROM cart_items WHERE cart_id = ?', [cartId]);
  if (items.length === 0) {
    return res.status(400).json({ error: 'Cannot complete an empty cart. Please add at least one item.' });
  }

  // Update cart status to COMPLETED
  dbQuery.run(
    `UPDATE carts SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [cartId]
  );

  // Sync to orders and receipts table for archival & order history
  const receiptNumber = `RCP-${Date.now().toString().slice(-6)}`;
  const processedItems = items.map((i: any) => ({
    name: i.item_name_snapshot,
    qty: i.quantity,
    price: i.price_snapshot,
    total: i.subtotal,
  }));

  const receiptData = {
    receiptNumber,
    orderNumber: cart.cart_number,
    date: new Date().toISOString(),
    customerName: cart.customer_name || 'Walk-in Customer',
    items: processedItems,
    subtotal: cart.total,
    discount: 0,
    tax: 0,
    grandTotal: cart.total,
    paymentMethod: 'NOT_RECORDED',
    paymentStatus: 'COMPLETED',
    staffName: cart.staff_name,
  };

  dbQuery.run(
    `INSERT OR REPLACE INTO receipts (receipt_number, order_id, customer_name, grand_total, payment_method, payment_status, receipt_data_json)
     VALUES (?, ?, ?, ?, 'NOT_RECORDED', 'COMPLETED', ?)`,
    [receiptNumber, cartId, cart.customer_name, cart.total, JSON.stringify(receiptData)]
  );

  // Sync into orders table for history
  dbQuery.run(
    `INSERT OR REPLACE INTO orders (id, order_number, customer_name, subtotal, discount, tax, grand_total, payment_method, payment_status, staff_id, staff_name, status, created_at)
     VALUES (?, ?, ?, ?, 0, 0, ?, 'OTHER', 'PAID', ?, ?, 'COMPLETED', ?)`,
    [cartId, cart.cart_number, cart.customer_name, cart.total, cart.total, cart.staff_id, cart.staff_name, cart.created_at]
  );

  const completedCart = dbQuery.get('SELECT * FROM carts WHERE id = ?', [cartId]);

  return res.json({
    cart: completedCart,
    items,
    receiptNumber,
    receiptData,
  });
});

// POST cancel cart
router.post('/:id/cancel', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const cartId = Number(req.params.id);
  const cart = dbQuery.get('SELECT * FROM carts WHERE id = ?', [req.params.id]);

  if (!cart) return res.status(404).json({ error: 'Cart not found' });
  dbQuery.run(`UPDATE carts SET status = 'CANCELLED' WHERE id = ?`, [cartId]);

  return res.json({ message: 'Cart cancelled successfully' });
});

export default router;
