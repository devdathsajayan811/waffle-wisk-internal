import { Router } from 'express';
import { z } from 'zod';
import { db, SqlParam } from '../db/index.js';
import { audit } from '../lib/audit.js';
import { badRequest, idParam, notFound, optionalNumber, optionalString, parse, roundMoney } from '../lib/http.js';
import { AuthenticatedRequest, authenticateToken, currentUser, requireRole } from '../middleware/auth.js';

const router = Router();

interface InventoryRow {
  id: number;
  name: string;
  unit: string;
  current_quantity: number;
  [key: string]: any;
}

const listQuerySchema = z.object({
  category: z.string().max(100).optional(),
  search: z.string().trim().max(100).optional(),
  low_stock_only: z.enum(['true', 'false']).optional(),
});

router.get('/', authenticateToken, async (req, res) => {
  const query = parse(listQuerySchema, req.query);
  let sql = 'SELECT * FROM inventory_items WHERE 1=1';
  const params: SqlParam[] = [];

  if (query.category && query.category !== 'all') {
    sql += ' AND category = ?';
    params.push(query.category);
  }
  if (query.low_stock_only === 'true') {
    sql += ' AND current_quantity <= minimum_stock';
  }
  if (query.search) {
    sql += ' AND (name LIKE ? OR supplier LIKE ?)';
    const term = `%${query.search}%`;
    params.push(term, term);
  }
  sql += ' ORDER BY name ASC';

  return res.json(await db.all(sql, params));
});

router.get('/low-stock', authenticateToken, async (_req, res) => {
  const inventory = await db.all(
    'SELECT * FROM inventory_items WHERE current_quantity <= minimum_stock ORDER BY current_quantity ASC'
  );
  const products = await db.all(
    `SELECT p.*, c.name AS category_name FROM products p JOIN categories c ON p.category_id = c.id
     WHERE p.is_archived = 0 AND p.stock_quantity <= p.low_stock_threshold ORDER BY p.stock_quantity ASC`
  );
  return res.json({ inventory, products });
});

const movementTypes = ['IN', 'OUT', 'SALE_DEDUCTION', 'ADJUSTMENT'] as const;

const movementQuerySchema = z.object({
  itemId: z.coerce.number().int().positive().optional(),
  type: z.enum(movementTypes).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

router.get('/movements', authenticateToken, async (req, res) => {
  const query = parse(movementQuerySchema, req.query);
  let sql = `SELECT m.*, i.name AS item_name, i.unit AS item_unit
    FROM inventory_movements m JOIN inventory_items i ON m.inventory_item_id = i.id WHERE 1=1`;
  const params: SqlParam[] = [];

  if (query.itemId) {
    sql += ' AND m.inventory_item_id = ?';
    params.push(query.itemId);
  }
  if (query.type) {
    sql += ' AND m.type = ?';
    params.push(query.type);
  }
  sql += ' ORDER BY m.created_at DESC, m.id DESC LIMIT ?';
  params.push(query.limit ?? 50);

  return res.json(await db.all(sql, params));
});

const itemFields = {
  name: z.string().trim().min(1, 'Name is required').max(150),
  category: z.string().trim().min(1, 'Category is required').max(100),
  unit: z.string().trim().min(1, 'Unit is required').max(30),
  current_quantity: optionalNumber(z.number().min(0)),
  minimum_stock: optionalNumber(z.number().min(0)),
  cost_per_unit: optionalNumber(z.number().min(0)),
  supplier: optionalString(150),
  expiry_date: z.preprocess(
    (v) => (v === '' ? null : v),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expiry_date must be YYYY-MM-DD').nullable().optional()
  ),
};

router.post('/', authenticateToken, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  const actor = currentUser(req);
  const data = parse(z.object(itemFields), req.body);
  const quantity = data.current_quantity ?? 0;
  const costPerUnit = data.cost_per_unit ?? 0;

  const item = await db.transaction(async (tx) => {
    const { lastInsertRowid: id } = await tx.run(
      `INSERT INTO inventory_items (name, category, current_quantity, unit, minimum_stock, cost_per_unit, supplier, last_restocked, expiry_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)`,
      [data.name, data.category, quantity, data.unit, data.minimum_stock ?? 5, costPerUnit, data.supplier ?? '', data.expiry_date ?? null]
    );
    if (quantity > 0) {
      await tx.run(
        `INSERT INTO inventory_movements (inventory_item_id, type, quantity, reason, cost, notes, created_by, created_by_name)
         VALUES (?, 'IN', ?, 'Initial Stock Entry', ?, 'Item creation', ?, ?)`,
        [id, quantity, roundMoney(costPerUnit * quantity), actor.id, actor.name]
      );
    }
    await audit(tx, actor, 'ADD_INVENTORY', `Added inventory item: ${data.name} (${quantity} ${data.unit})`, req.ip);
    return tx.get('SELECT * FROM inventory_items WHERE id = ?', [id]);
  });

  return res.status(201).json(item);
});

router.put('/:id', authenticateToken, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  const actor = currentUser(req);
  const { id } = parse(idParam, req.params);
  const { current_quantity: _ignored, ...fields } = itemFields;
  const data = parse(z.object(fields).partial(), req.body);

  const item = await db.transaction(async (tx) => {
    const existing = await tx.get<InventoryRow>('SELECT * FROM inventory_items WHERE id = ?', [id]);
    if (!existing) throw notFound('Item not found');

    await tx.run(
      `UPDATE inventory_items SET name = ?, category = ?, unit = ?, minimum_stock = ?, cost_per_unit = ?, supplier = ?,
         expiry_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [
        data.name ?? existing.name,
        data.category ?? existing.category,
        data.unit ?? existing.unit,
        data.minimum_stock ?? existing.minimum_stock,
        data.cost_per_unit ?? existing.cost_per_unit,
        data.supplier ?? existing.supplier,
        data.expiry_date !== undefined ? data.expiry_date : existing.expiry_date,
        id,
      ]
    );
    await audit(tx, actor, 'UPDATE_INVENTORY', `Updated inventory item details: ${data.name ?? existing.name}`, req.ip);
    return tx.get('SELECT * FROM inventory_items WHERE id = ?', [id]);
  });

  return res.json(item);
});

const movementSchema = z.object({
  inventory_item_id: z.coerce.number().int().positive(),
  type: z.enum(movementTypes),
  quantity: z.coerce.number().min(0),
  reason: z.string().trim().min(1, 'Reason is required').max(200),
  cost: optionalNumber(z.number().min(0)),
  notes: optionalString(500),
});

router.post('/movements', authenticateToken, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  const actor = currentUser(req);
  const data = parse(movementSchema, req.body);
  if (data.type !== 'ADJUSTMENT' && data.quantity <= 0) throw badRequest('Quantity must be greater than zero');

  const item = await db.transaction(async (tx) => {
    const existing = await tx.get<InventoryRow>('SELECT * FROM inventory_items WHERE id = ?', [data.inventory_item_id]);
    if (!existing) throw notFound('Inventory item not found');

    const current = Number(existing.current_quantity);
    const newStock =
      data.type === 'IN' ? current + data.quantity : data.type === 'ADJUSTMENT' ? data.quantity : current - data.quantity;
    if (newStock < 0) throw badRequest(`Cannot remove ${data.quantity} ${existing.unit}; only ${current} in stock`);

    await tx.run(
      `UPDATE inventory_items SET current_quantity = ?,
         last_restocked = CASE WHEN ? = 'IN' THEN CURRENT_TIMESTAMP ELSE last_restocked END,
         updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [newStock, data.type, data.inventory_item_id]
    );
    await tx.run(
      `INSERT INTO inventory_movements (inventory_item_id, type, quantity, reason, cost, notes, created_by, created_by_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.inventory_item_id, data.type, data.quantity, data.reason, data.cost ?? 0, data.notes ?? '', actor.id, actor.name]
    );
    await audit(
      tx,
      actor,
      'STOCK_MOVEMENT',
      `Stock ${data.type} for ${existing.name}: ${data.quantity} ${existing.unit} (${data.reason})`,
      req.ip
    );
    return tx.get('SELECT * FROM inventory_items WHERE id = ?', [data.inventory_item_id]);
  });

  return res.json({ message: 'Stock movement recorded successfully', item });
});

export default router;
