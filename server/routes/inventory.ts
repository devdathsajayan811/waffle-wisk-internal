import { Router, Response } from 'express';
import { dbQuery } from '../db.js';
import { AuthenticatedRequest, authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

// Get Inventory List
router.get('/', authenticateToken, (req, res) => {
  const { category, search, low_stock_only } = req.query;

  let sql = `SELECT * FROM inventory_items WHERE 1=1`;
  const params: any[] = [];

  if (category && category !== 'all') {
    sql += ` AND category = ?`;
    params.push(category);
  }

  if (low_stock_only === 'true') {
    sql += ` AND current_quantity <= minimum_stock`;
  }

  if (search && typeof search === 'string' && search.trim() !== '') {
    sql += ` AND (name LIKE ? OR supplier LIKE ?)`;
    const term = `%${search.trim()}%`;
    params.push(term, term);
  }

  sql += ` ORDER BY name ASC`;

  const items = dbQuery.all(sql, params);
  return res.json(items);
});

// Low Stock Items Only
router.get('/low-stock', authenticateToken, (_req, res) => {
  const lowStockInventory = dbQuery.all(`SELECT * FROM inventory_items WHERE current_quantity <= minimum_stock ORDER BY current_quantity ASC`);
  const lowStockProducts = dbQuery.all(`SELECT p.*, c.name as category_name FROM products p JOIN categories c ON p.category_id = c.id WHERE stock_quantity <= low_stock_threshold ORDER BY stock_quantity ASC`);

  return res.json({
    inventory: lowStockInventory,
    products: lowStockProducts,
  });
});

// Get Stock Movements Log
router.get('/movements', authenticateToken, (req, res) => {
  const { itemId, type, limit } = req.query;
  let sql = `
    SELECT m.*, i.name as item_name, i.unit as item_unit
    FROM inventory_movements m
    JOIN inventory_items i ON m.inventory_item_id = i.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (itemId) {
    sql += ` AND m.inventory_item_id = ?`;
    params.push(itemId);
  }

  if (type) {
    sql += ` AND m.type = ?`;
    params.push(type);
  }

  sql += ` ORDER BY m.created_at DESC LIMIT ?`;
  params.push(limit ? Number(limit) : 50);

  const movements = dbQuery.all(sql, params);
  return res.json(movements);
});

// Add Inventory Item (Admin Only)
router.post('/', authenticateToken, requireRole('ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  const { name, category, current_quantity, unit, minimum_stock, cost_per_unit, supplier, expiry_date } = req.body;

  if (!name || !category || !unit) {
    return res.status(400).json({ error: 'Name, Category, and Unit are required' });
  }

  const result = dbQuery.run(
    `INSERT INTO inventory_items (name, category, current_quantity, unit, minimum_stock, cost_per_unit, supplier, last_restocked, expiry_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)`,
    [
      name.trim(),
      category,
      current_quantity !== undefined ? Number(current_quantity) : 0,
      unit,
      minimum_stock !== undefined ? Number(minimum_stock) : 5,
      cost_per_unit !== undefined ? Number(cost_per_unit) : 0,
      supplier || '',
      expiry_date || null,
    ]
  );

  const newItem = dbQuery.get('SELECT * FROM inventory_items WHERE id = ?', [result.lastInsertRowid]);

  // Log movement if initial stock > 0
  if (Number(current_quantity) > 0) {
    dbQuery.run(
      `INSERT INTO inventory_movements (inventory_item_id, type, quantity, reason, cost, notes, created_by, created_by_name)
       VALUES (?, 'IN', ?, 'Initial Stock Entry', ?, 'Item creation', ?, ?)`,
      [result.lastInsertRowid, Number(current_quantity), Number(cost_per_unit || 0) * Number(current_quantity), req.user!.id, req.user!.name]
    );
  }

  dbQuery.run(
    `INSERT INTO audit_logs (action, user_id, user_name, user_role, description) VALUES (?, ?, ?, ?, ?)`,
    ['ADD_INVENTORY', req.user!.id, req.user!.name, req.user!.role, `Added inventory item: ${name} (${current_quantity} ${unit})`]
  );

  return res.status(201).json(newItem);
});

// Edit Inventory Item (Admin Only)
router.put('/:id', authenticateToken, requireRole('ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  const id = Number(req.params.id);
  const existing = dbQuery.get('SELECT * FROM inventory_items WHERE id = ?', [id]);
  if (!existing) return res.status(404).json({ error: 'Item not found' });

  const { name, category, unit, minimum_stock, cost_per_unit, supplier, expiry_date } = req.body;

  dbQuery.run(
    `UPDATE inventory_items SET
      name = ?,
      category = ?,
      unit = ?,
      minimum_stock = ?,
      cost_per_unit = ?,
      supplier = ?,
      expiry_date = ?,
      updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      name ? name.trim() : existing.name,
      category || existing.category,
      unit || existing.unit,
      minimum_stock !== undefined ? Number(minimum_stock) : existing.minimum_stock,
      cost_per_unit !== undefined ? Number(cost_per_unit) : existing.cost_per_unit,
      supplier !== undefined ? supplier : existing.supplier,
      expiry_date !== undefined ? expiry_date : existing.expiry_date,
      id,
    ]
  );

  const updated = dbQuery.get('SELECT * FROM inventory_items WHERE id = ?', [id]);

  dbQuery.run(
    `INSERT INTO audit_logs (action, user_id, user_name, user_role, description) VALUES (?, ?, ?, ?, ?)`,
    ['UPDATE_INVENTORY', req.user!.id, req.user!.name, req.user!.role, `Updated inventory item details: ${name || existing.name}`]
  );

  return res.json(updated);
});

// Record Stock Movement (Stock In / Stock Out / Adjustment)
router.post('/movements', authenticateToken, requireRole('ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  const { inventory_item_id, type, quantity, reason, cost, notes } = req.body;

  if (!inventory_item_id || !type || !quantity || !reason) {
    return res.status(400).json({ error: 'Item ID, Movement Type, Quantity, and Reason are required' });
  }

  const item = dbQuery.get('SELECT * FROM inventory_items WHERE id = ?', [inventory_item_id]);
  if (!item) return res.status(404).json({ error: 'Inventory item not found' });

  const qty = Number(quantity);
  if (qty <= 0) return res.status(400).json({ error: 'Quantity must be greater than zero' });

  let newStock = Number(item.current_quantity);
  if (type === 'IN') {
    newStock += qty;
  } else if (type === 'OUT' || type === 'SALE_DEDUCTION') {
    newStock = Math.max(0, newStock - qty);
  } else if (type === 'ADJUSTMENT') {
    newStock = qty;
  }

  // Update item
  dbQuery.run(
    `UPDATE inventory_items SET current_quantity = ?, last_restocked = CASE WHEN ? = 'IN' THEN CURRENT_TIMESTAMP ELSE last_restocked END, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [newStock, type, inventory_item_id]
  );

  // Insert movement
  dbQuery.run(
    `INSERT INTO inventory_movements (inventory_item_id, type, quantity, reason, cost, notes, created_by, created_by_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [inventory_item_id, type, qty, reason, cost !== undefined ? Number(cost) : 0, notes || '', req.user!.id, req.user!.name]
  );

  dbQuery.run(
    `INSERT INTO audit_logs (action, user_id, user_name, user_role, description) VALUES (?, ?, ?, ?, ?)`,
    ['STOCK_MOVEMENT', req.user!.id, req.user!.name, req.user!.role, `Stock ${type} for ${item.name}: ${qty} ${item.unit} (${reason})`]
  );

  const updatedItem = dbQuery.get('SELECT * FROM inventory_items WHERE id = ?', [inventory_item_id]);
  return res.json({ message: 'Stock movement recorded successfully', item: updatedItem });
});

export default router;
