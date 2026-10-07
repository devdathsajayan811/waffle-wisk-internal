import { Router } from 'express';
import { z } from 'zod';
import { db, SqlParam } from '../db/index.js';
import { parse, roundMoney } from '../lib/http.js';
import { getBusinessTimeZone } from '../lib/settings.js';
import { rangeClause, resolveDateRange, sqliteOffsetModifier } from '../lib/time.js';
import { AuthenticatedRequest, authenticateToken, currentUser, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

const salesQuerySchema = z.object({
  range: z.enum(['today', 'yesterday', '7days', '30days', 'all']).optional(),
});

// Staff see their own sales; admins see the whole business.
router.get('/sales', async (req: AuthenticatedRequest, res) => {
  const actor = currentUser(req);
  const { range } = parse(salesQuerySchema, req.query);
  const timeZone = await getBusinessTimeZone(db);
  const resolved = resolveDateRange(timeZone, { range: range ?? 'all' });

  const filter = (alias: string, params: SqlParam[]) => {
    let sql = rangeClause(`${alias}created_at`, resolved, params);
    if (actor.role === 'STAFF') {
      sql += ` AND ${alias}staff_id = ?`;
      params.push(actor.id);
    }
    return sql;
  };

  const summaryParams: SqlParam[] = [];
  const summary = await db.get<{ total_sales: number; total_orders: number; avg_order_value: number }>(
    `SELECT COALESCE(SUM(grand_total), 0) AS total_sales, COUNT(id) AS total_orders, COALESCE(AVG(grand_total), 0) AS avg_order_value
     FROM orders WHERE status = 'COMPLETED'${filter('', summaryParams)}`,
    summaryParams
  );

  const pendingParams: SqlParam[] = [];
  const pending = await db.get<{ count: number }>(
    `SELECT COUNT(id) AS count FROM orders WHERE payment_status = 'PENDING'${filter('', pendingParams)}`,
    pendingParams
  );

  const itemsParams: SqlParam[] = [];
  const itemsSold = await db.get<{ total_items: number }>(
    `SELECT COALESCE(SUM(oi.quantity), 0) AS total_items FROM order_items oi JOIN orders o ON oi.order_id = o.id
     WHERE o.status = 'COMPLETED'${filter('o.', itemsParams)}`,
    itemsParams
  );

  const lowStock = await db.get<{ count: number }>(
    'SELECT COUNT(id) AS count FROM products WHERE is_archived = 0 AND stock_quantity <= low_stock_threshold'
  );

  const topParams: SqlParam[] = [];
  const topProducts = await db.all(
    `SELECT oi.product_name, SUM(oi.quantity) AS qty_sold, SUM(oi.total_price) AS revenue
     FROM order_items oi JOIN orders o ON oi.order_id = o.id
     WHERE o.status = 'COMPLETED'${filter('o.', topParams)}
     GROUP BY oi.product_name ORDER BY qty_sold DESC LIMIT 5`,
    topParams
  );

  const chartParams: SqlParam[] = [sqliteOffsetModifier(timeZone)];
  const chartData = await db.all(
    `SELECT DATE(created_at, ?) AS date, COUNT(id) AS orders, SUM(grand_total) AS revenue
     FROM orders WHERE status = 'COMPLETED'${filter('', chartParams)}
     GROUP BY 1 ORDER BY date ASC`,
    chartParams
  );

  return res.json({
    totalSales: roundMoney(Number(summary?.total_sales ?? 0)),
    totalOrders: Number(summary?.total_orders ?? 0),
    avgOrderValue: roundMoney(Number(summary?.avg_order_value ?? 0)),
    totalProductsSold: Number(itemsSold?.total_items ?? 0),
    pendingOrders: Number(pending?.count ?? 0),
    lowStockCount: Number(lowStock?.count ?? 0),
    topProducts,
    chartData,
  });
});

router.get('/products', requireRole('ADMIN'), async (_req, res) => {
  return res.json(
    await db.all(
      `SELECT p.id, p.name, p.price, p.stock_quantity, c.name AS category_name,
              COALESCE(s.total_sold, 0) AS total_sold, COALESCE(s.total_revenue, 0) AS total_revenue
       FROM products p
       JOIN categories c ON p.category_id = c.id
       LEFT JOIN (
         SELECT oi.product_id, SUM(oi.quantity) AS total_sold, SUM(oi.total_price) AS total_revenue
         FROM order_items oi JOIN orders o ON o.id = oi.order_id
         WHERE o.status = 'COMPLETED'
         GROUP BY oi.product_id
       ) s ON s.product_id = p.id
       WHERE p.is_archived = 0
       ORDER BY total_sold DESC`
    )
  );
});

router.get('/payments', requireRole('ADMIN'), async (_req, res) => {
  return res.json(
    await db.all(
      `SELECT payment_method, COUNT(id) AS count, SUM(grand_total) AS total_amount
       FROM orders WHERE status = 'COMPLETED' GROUP BY payment_method`
    )
  );
});

router.get('/inventory', requireRole('ADMIN'), async (_req, res) => {
  const items = await db.all('SELECT *, (current_quantity * cost_per_unit) AS stock_value FROM inventory_items ORDER BY name ASC');
  const total = await db.get<{ total_val: number }>('SELECT SUM(current_quantity * cost_per_unit) AS total_val FROM inventory_items');
  return res.json({ items, totalValuation: roundMoney(Number(total?.total_val ?? 0)) });
});

export default router;
