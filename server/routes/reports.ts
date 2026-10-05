import { Router, Response } from 'express';
import { dbQuery } from '../db.js';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth.js';

const router = Router();

// Sales Report & Dashboard Charts
router.get('/sales', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { range } = req.query; // 'today', '7days', '30days', 'all'
  const now = new Date();
  let startDateStr = '';

  if (range === 'today') {
    startDateStr = `${now.toISOString().slice(0, 10)} 00:00:00`;
  } else if (range === '7days') {
    const d7 = new Date(now.getTime() - 7 * 86400000);
    startDateStr = d7.toISOString();
  } else if (range === '30days') {
    const d30 = new Date(now.getTime() - 30 * 86400000);
    startDateStr = d30.toISOString();
  } else {
    startDateStr = '2000-01-01 00:00:00';
  }

  // Aggregate Metrics
  const summaryRes = dbQuery.get(
    `SELECT
      COALESCE(SUM(grand_total), 0) as total_sales,
      COUNT(id) as total_orders,
      COALESCE(AVG(grand_total), 0) as avg_order_value
     FROM orders
     WHERE status = 'COMPLETED' AND created_at >= ?`,
    [startDateStr]
  );

  const pendingRes = dbQuery.get(
    `SELECT COUNT(id) as count FROM orders WHERE payment_status = 'PENDING' AND created_at >= ?`,
    [startDateStr]
  );

  const itemsSoldRes = dbQuery.get(
    `SELECT COALESCE(SUM(oi.quantity), 0) as total_items
     FROM order_items oi
     JOIN orders o ON oi.order_id = o.id
     WHERE o.status = 'COMPLETED' AND o.created_at >= ?`,
    [startDateStr]
  );

  const lowStockRes = dbQuery.get(
    `SELECT COUNT(id) as count FROM products WHERE stock_quantity <= low_stock_threshold`
  );

  // Top Selling Products
  const topProducts = dbQuery.all(
    `SELECT oi.product_name, SUM(oi.quantity) as qty_sold, SUM(oi.total_price) as revenue
     FROM order_items oi
     JOIN orders o ON oi.order_id = o.id
     WHERE o.status = 'COMPLETED' AND o.created_at >= ?
     GROUP BY oi.product_name
     ORDER BY qty_sold DESC
     LIMIT 5`,
    [startDateStr]
  );

  // Sales Chart Timeline Data
  const chartData = dbQuery.all(
    `SELECT
      DATE(created_at) as date,
      COUNT(id) as orders,
      SUM(grand_total) as revenue
     FROM orders
     WHERE status = 'COMPLETED' AND created_at >= ?
     GROUP BY DATE(created_at)
     ORDER BY date ASC`,
    [startDateStr]
  );

  return res.json({
    totalSales: Number(summaryRes?.total_sales || 0),
    totalOrders: Number(summaryRes?.total_orders || 0),
    avgOrderValue: Number(summaryRes?.avg_order_value || 0),
    totalProductsSold: Number(itemsSoldRes?.total_items || 0),
    pendingOrders: Number(pendingRes?.count || 0),
    lowStockCount: Number(lowStockRes?.count || 0),
    topProducts,
    chartData,
  });
});

// Product Sales Report
router.get('/products', authenticateToken, (_req, res) => {
  const productPerformance = dbQuery.all(
    `SELECT p.id, p.name, p.price, p.stock_quantity, c.name as category_name,
            COALESCE(SUM(oi.quantity), 0) as total_sold,
            COALESCE(SUM(oi.total_price), 0) as total_revenue
     FROM products p
     JOIN categories c ON p.category_id = c.id
     LEFT JOIN order_items oi ON p.id = oi.product_id
     GROUP BY p.id
     ORDER BY total_sold DESC`
  );

  return res.json(productPerformance);
});

// Payment Method Breakdown Report
router.get('/payments', authenticateToken, (_req, res) => {
  const breakdown = dbQuery.all(
    `SELECT payment_method, COUNT(id) as count, SUM(grand_total) as total_amount
     FROM orders
     WHERE status = 'COMPLETED'
     GROUP BY payment_method`
  );

  return res.json(breakdown);
});

// Inventory Storage Report
router.get('/inventory', authenticateToken, (_req, res) => {
  const items = dbQuery.all(`SELECT *, (current_quantity * cost_per_unit) as stock_value FROM inventory_items ORDER BY name ASC`);
  const totalValuationRes = dbQuery.get(`SELECT SUM(current_quantity * cost_per_unit) as total_val FROM inventory_items`);

  return res.json({
    items,
    totalValuation: Number(totalValuationRes?.total_val || 0),
  });
});

export default router;
