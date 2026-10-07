import { randomUUID } from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { db, Queryable, SqlParam } from '../db/index.js';
import { audit } from '../lib/audit.js';
import { badRequest, forbidden, formatNumber, idParam, notFound, optionalString, parse, roundMoney } from '../lib/http.js';
import { getBusinessTimeZone } from '../lib/settings.js';
import { rangeClause, resolveDateRange } from '../lib/time.js';
import { AuthUser, AuthenticatedRequest, authenticateToken, currentUser } from '../middleware/auth.js';
import { checkoutSchema, createOrder } from '../services/orderService.js';

const router = Router();

interface CartRow {
  id: number;
  cart_number: string;
  staff_id: number;
  staff_name: string;
  customer_name: string;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  total: number;
  created_at: string;
  completed_at: string | null;
}

interface CartItemRow {
  id: number;
  cart_id: number;
  product_id: number;
  item_name_snapshot: string;
  price_snapshot: number;
  quantity: number;
  subtotal: number;
}

async function loadCartForUser(q: Queryable, cartId: number, actor: AuthUser): Promise<CartRow> {
  const cart = await q.get<CartRow>('SELECT * FROM carts WHERE id = ?', [cartId]);
  if (!cart) throw notFound('Cart not found');
  if (actor.role === 'STAFF' && cart.staff_id !== actor.id) {
    throw forbidden('Access denied: You can only access your assigned carts.');
  }
  return cart;
}

async function itemsByCart(q: Queryable, cartIds: number[]): Promise<Map<number, CartItemRow[]>> {
  const map = new Map<number, CartItemRow[]>();
  if (cartIds.length === 0) return map;
  const rows = await q.all<CartItemRow>(
    `SELECT * FROM cart_items WHERE cart_id IN (${cartIds.map(() => '?').join(', ')}) ORDER BY id`,
    cartIds
  );
  for (const row of rows) {
    const list = map.get(row.cart_id) ?? [];
    list.push(row);
    map.set(row.cart_id, list);
  }
  return map;
}

const withItems = (cart: CartRow, items: CartItemRow[]) => ({
  ...cart,
  items,
  itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
});

const listQuerySchema = z.object({
  status: z.union([z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED']), z.literal('all')]).optional(),
  own_carts_only: z.enum(['true', 'false']).optional(),
});

router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const actor = currentUser(req);
  const query = parse(listQuerySchema, req.query);

  let sql = 'SELECT * FROM carts WHERE 1=1';
  const params: SqlParam[] = [];
  if (actor.role === 'STAFF' || query.own_carts_only === 'true') {
    sql += ' AND staff_id = ?';
    params.push(actor.id);
  }
  if (query.status && query.status !== 'all') {
    sql += ' AND status = ?';
    params.push(query.status);
  }
  sql += ' ORDER BY id DESC LIMIT 200';

  const carts = await db.all<CartRow>(sql, params);
  const items = await itemsByCart(db, carts.map((c) => c.id));
  return res.json(carts.map((cart) => withItems(cart, items.get(cart.id) ?? [])));
});

router.get('/stats/today', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const actor = currentUser(req);
  const timeZone = await getBusinessTimeZone(db);
  const today = resolveDateRange(timeZone, { range: 'today' });

  const scope = actor.role === 'STAFF' ? ' AND staff_id = ?' : '';
  const scopeParams: SqlParam[] = actor.role === 'STAFF' ? [actor.id] : [];

  const active = await db.get<{ count: number }>(
    `SELECT COUNT(*) AS count FROM carts WHERE status = 'ACTIVE'${scope}`,
    scopeParams
  );

  const completedParams: SqlParam[] = [...scopeParams];
  const completed = await db.get<{ count: number }>(
    `SELECT COUNT(*) AS count FROM carts WHERE status = 'COMPLETED'${scope}${rangeClause('completed_at', today, completedParams)}`,
    completedParams
  );

  const salesParams: SqlParam[] = [...scopeParams];
  const sales = await db.get<{ total: number }>(
    `SELECT COALESCE(SUM(grand_total), 0) AS total FROM orders WHERE status = 'COMPLETED'${scope}${rangeClause('created_at', today, salesParams)}`,
    salesParams
  );

  return res.json({
    activeCarts: Number(active?.count ?? 0),
    completedCarts: Number(completed?.count ?? 0),
    todayTotal: roundMoney(Number(sales?.total ?? 0)),
  });
});

router.post('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const actor = currentUser(req);
  const { customer_name } = parse(z.object({ customer_name: optionalString(100) }), req.body);

  const cart = await db.transaction(async (tx) => {
    const { lastInsertRowid: id } = await tx.run(
      `INSERT INTO carts (cart_number, staff_id, staff_name, customer_name, status, total) VALUES (?, ?, ?, ?, 'ACTIVE', 0)`,
      [`TMP-${randomUUID()}`, actor.id, actor.name, customer_name || 'Walk-in Customer']
    );
    await tx.run('UPDATE carts SET cart_number = ? WHERE id = ?', [formatNumber('CART', id), id]);
    return tx.get<CartRow>('SELECT * FROM carts WHERE id = ?', [id]);
  });

  return res.status(201).json(withItems(cart!, []));
});

router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const actor = currentUser(req);
  const { id } = parse(idParam, req.params);
  const cart = await loadCartForUser(db, id, actor);

  const items = (await itemsByCart(db, [cart.id])).get(cart.id) ?? [];
  const receipt = await db.get(
    `SELECT r.* FROM receipts r JOIN orders o ON o.id = r.order_id WHERE o.cart_id = ?`,
    [cart.id]
  );
  return res.json({ ...withItems(cart, items), receipt });
});

const updateItemsSchema = z.object({
  items: z
    .array(
      z.object({
        product_id: z.coerce.number().int().positive(),
        quantity: z.coerce.number().int('Quantity must be a whole number').min(0).max(1000),
      })
    )
    .max(100),
});

// Replaces the cart contents while preserving the price snapshot of items already in the cart.
router.put('/:id/items', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const actor = currentUser(req);
  const { id } = parse(idParam, req.params);
  const { items } = parse(updateItemsSchema, req.body);

  const result = await db.transaction(async (tx) => {
    const cart = await loadCartForUser(tx, id, actor);
    if (cart.status !== 'ACTIVE') throw badRequest('Cannot modify a completed or cancelled cart.');

    const existing = (await itemsByCart(tx, [id])).get(id) ?? [];
    const snapshots = new Map(existing.map((item) => [item.product_id, item]));
    await tx.run('DELETE FROM cart_items WHERE cart_id = ?', [id]);

    let total = 0;
    for (const { product_id, quantity } of items) {
      if (quantity === 0) continue;

      let name: string;
      let price: number;
      const snapshot = snapshots.get(product_id);
      if (snapshot) {
        name = snapshot.item_name_snapshot;
        price = snapshot.price_snapshot;
      } else {
        const product = await tx.get<{ name: string; price: number; discount_price: number | null; is_archived: number }>(
          'SELECT name, price, discount_price, is_archived FROM products WHERE id = ?',
          [product_id]
        );
        if (!product || product.is_archived) throw badRequest(`Product ID ${product_id} not found`);
        name = product.name;
        price = Number(product.discount_price || product.price);
      }

      const subtotal = roundMoney(price * quantity);
      total += subtotal;
      await tx.run(
        `INSERT INTO cart_items (cart_id, product_id, item_name_snapshot, price_snapshot, quantity, subtotal) VALUES (?, ?, ?, ?, ?, ?)`,
        [id, product_id, name, price, quantity, subtotal]
      );
    }

    await tx.run('UPDATE carts SET total = ? WHERE id = ?', [roundMoney(total), id]);
    const updated = await tx.get<CartRow>('SELECT * FROM carts WHERE id = ?', [id]);
    const updatedItems = (await itemsByCart(tx, [id])).get(id) ?? [];
    return withItems(updated!, updatedItems);
  });

  return res.json(result);
});

const completeSchema = checkoutSchema.extend({
  payment_status: z.enum(['PAID', 'PENDING']).optional(),
});

router.post('/:id/complete', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const actor = currentUser(req);
  const { id } = parse(idParam, req.params);
  const checkout = parse(completeSchema, req.body);

  const result = await db.transaction(async (tx) => {
    const cart = await loadCartForUser(tx, id, actor);
    if (cart.status !== 'ACTIVE') throw badRequest('Cart is already completed or cancelled.');

    const items = (await itemsByCart(tx, [id])).get(id) ?? [];
    if (items.length === 0) throw badRequest('Cannot complete an empty cart. Please add at least one item.');

    const order = await createOrder(
      tx,
      actor,
      items.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.price_snapshot,
        name: item.item_name_snapshot,
      })),
      { ...checkout, customer_name: checkout.customer_name || cart.customer_name },
      { cartId: id, ip: req.ip }
    );

    await tx.run(`UPDATE carts SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
    const completedCart = await tx.get<CartRow>('SELECT * FROM carts WHERE id = ?', [id]);
    return { cart: completedCart, ...order };
  });

  return res.json(result);
});

router.post('/:id/cancel', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const actor = currentUser(req);
  const { id } = parse(idParam, req.params);

  await db.transaction(async (tx) => {
    const cart = await loadCartForUser(tx, id, actor);
    if (cart.status !== 'ACTIVE') throw badRequest('Only active carts can be cancelled.');
    await tx.run(`UPDATE carts SET status = 'CANCELLED' WHERE id = ?`, [id]);
    await audit(tx, actor, 'CANCEL_CART', `Cancelled cart ${cart.cart_number}`, req.ip);
  });

  return res.json({ message: 'Cart cancelled successfully' });
});

export default router;
