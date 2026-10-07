import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { db, SqlParam } from '../db/index.js';
import { audit } from '../lib/audit.js';
import { badRequest, clearableNumber, idParam, notFound, optionalNumber, optionalString, parse } from '../lib/http.js';
import { AuthenticatedRequest, authenticateToken, currentUser, requireRole } from '../middleware/auth.js';
import { allowedImageTypes, storeImage } from '../services/storage.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (allowedImageTypes.includes(file.mimetype)) cb(null, true);
    else cb(badRequest('Only JPEG, PNG, WebP or GIF images are allowed'));
  },
});

const PRODUCT_SELECT = `SELECT p.*, c.name AS category_name, c.slug AS category_slug
  FROM products p JOIN categories c ON p.category_id = c.id`;

interface ProductRow {
  id: number;
  name: string;
  price: number;
  is_archived: number;
  availability: string;
}

router.post('/upload-image', authenticateToken, requireRole('ADMIN'), upload.single('image'), async (req, res) => {
  if (!req.file) throw badRequest('No image file uploaded');
  const imageUrl = await storeImage(req.file.buffer, req.file.mimetype);
  return res.json({ imageUrl });
});

router.get('/categories', authenticateToken, async (_req, res) => {
  return res.json(await db.all('SELECT * FROM categories ORDER BY display_order ASC'));
});

const listQuerySchema = z.object({
  category: z.string().max(100).optional(),
  availability: z.union([z.enum(['AVAILABLE', 'UNAVAILABLE', 'OUT_OF_STOCK']), z.literal('all')]).optional(),
  search: z.string().trim().max(100).optional(),
  include_archived: z.enum(['true', 'false']).optional(),
});

router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const actor = currentUser(req);
  const query = parse(listQuerySchema, req.query);

  let sql = `${PRODUCT_SELECT} WHERE 1=1`;
  const params: SqlParam[] = [];

  if (!(actor.role === 'ADMIN' && query.include_archived === 'true')) {
    sql += ' AND p.is_archived = 0';
  }
  if (query.category && query.category !== 'all') {
    sql += ' AND (c.slug = ? OR c.id = ?)';
    params.push(query.category, Number(query.category) || -1);
  }
  if (query.availability && query.availability !== 'all') {
    sql += ' AND p.availability = ?';
    params.push(query.availability);
  }
  if (query.search) {
    sql += ' AND (p.name LIKE ? OR p.sku LIKE ? OR p.description LIKE ?)';
    const term = `%${query.search}%`;
    params.push(term, term, term);
  }
  sql += ' ORDER BY p.id DESC';

  return res.json(await db.all(sql, params));
});

router.get('/:id', authenticateToken, async (req, res) => {
  const { id } = parse(idParam, req.params);
  const product = await db.get(`${PRODUCT_SELECT} WHERE p.id = ?`, [id]);
  if (!product) throw notFound('Product not found');
  const priceHistory = await db.all('SELECT * FROM price_history WHERE product_id = ? ORDER BY created_at DESC, id DESC', [id]);
  return res.json({ product, priceHistory });
});

const productFields = {
  sku: optionalString(50),
  name: z.string().trim().min(1, 'Name is required').max(150),
  category_id: z.coerce.number().int().positive(),
  description: optionalString(1000),
  image_url: optionalString(2000),
  price: z.coerce.number().min(0, 'Price must be a non-negative number'),
  discount_price: clearableNumber(z.number().min(0)),
  tax_percent: optionalNumber(z.number().min(0).max(100)),
  stock_quantity: optionalNumber(z.number().int().min(0)),
  low_stock_threshold: optionalNumber(z.number().int().min(0)),
  unit: optionalString(30),
  availability: z.enum(['AVAILABLE', 'UNAVAILABLE', 'OUT_OF_STOCK']).optional(),
};

const discountBelowPrice = (data: { price?: number; discount_price?: number | null }) =>
  data.discount_price == null || data.price === undefined || data.discount_price <= data.price;
const discountMessage = { message: 'Discount price cannot be higher than the price', path: ['discount_price'] };

const createSchema = z.object(productFields).refine(discountBelowPrice, discountMessage);
const updateSchema = z.object(productFields).partial().refine(discountBelowPrice, discountMessage);

router.post('/', authenticateToken, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  const actor = currentUser(req);
  const data = parse(createSchema, req.body);

  const created = await db.transaction(async (tx) => {
    const { lastInsertRowid } = await tx.run(
      `INSERT INTO products (sku, name, category_id, description, image_url, price, discount_price, tax_percent, stock_quantity, low_stock_threshold, unit, availability)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.sku || `WFL-${Date.now().toString(36).toUpperCase()}`,
        data.name,
        data.category_id,
        data.description ?? '',
        data.image_url ?? '',
        data.price,
        data.discount_price ?? null,
        data.tax_percent ?? 5,
        data.stock_quantity ?? 0,
        data.low_stock_threshold ?? 5,
        data.unit || 'pcs',
        data.availability ?? 'AVAILABLE',
      ]
    );
    await audit(tx, actor, 'CREATE_PRODUCT', `Created new product: ${data.name} (Price: ₹${data.price})`, req.ip);
    return tx.get(`${PRODUCT_SELECT} WHERE p.id = ?`, [lastInsertRowid]);
  });

  return res.status(201).json(created);
});

router.put('/:id', authenticateToken, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  const actor = currentUser(req);
  const { id } = parse(idParam, req.params);
  const data = parse(updateSchema, req.body);

  const updated = await db.transaction(async (tx) => {
    const existing = await tx.get<ProductRow & Record<string, any>>('SELECT * FROM products WHERE id = ?', [id]);
    if (!existing) throw notFound('Product not found');

    const newPrice = data.price ?? Number(existing.price);
    const newDiscount = data.discount_price !== undefined ? data.discount_price : existing.discount_price;
    if (newDiscount != null && newDiscount > newPrice) throw badRequest('Discount price cannot be higher than the price');

    if (data.price !== undefined && data.price !== Number(existing.price)) {
      await tx.run(
        'INSERT INTO price_history (product_id, old_price, new_price, updated_by, updated_by_name) VALUES (?, ?, ?, ?, ?)',
        [id, existing.price, data.price, actor.id, actor.name]
      );
      await audit(tx, actor, 'PRICE_CHANGE', `Price for '${existing.name}' updated from ₹${existing.price} to ₹${data.price}`, req.ip);
    }

    await tx.run(
      `UPDATE products SET sku = ?, name = ?, category_id = ?, description = ?, image_url = ?, price = ?, discount_price = ?,
         tax_percent = ?, stock_quantity = ?, low_stock_threshold = ?, unit = ?, availability = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        data.sku || existing.sku,
        data.name ?? existing.name,
        data.category_id ?? existing.category_id,
        data.description ?? existing.description,
        data.image_url ?? existing.image_url,
        newPrice,
        newDiscount,
        data.tax_percent ?? existing.tax_percent,
        data.stock_quantity ?? existing.stock_quantity,
        data.low_stock_threshold ?? existing.low_stock_threshold,
        data.unit || existing.unit,
        data.availability ?? existing.availability,
        id,
      ]
    );
    await audit(tx, actor, 'UPDATE_PRODUCT', `Updated product: ${data.name ?? existing.name}`, req.ip);
    return tx.get(`${PRODUCT_SELECT} WHERE p.id = ?`, [id]);
  });

  return res.json(updated);
});

const priceSchema = z
  .object({ price: z.coerce.number().min(0, 'Valid price is required'), discount_price: clearableNumber(z.number().min(0)) })
  .refine(discountBelowPrice, discountMessage);

router.patch('/:id/price', authenticateToken, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  const actor = currentUser(req);
  const { id } = parse(idParam, req.params);
  const { price, discount_price } = parse(priceSchema, req.body);

  const history = await db.transaction(async (tx) => {
    const existing = await tx.get<ProductRow>('SELECT * FROM products WHERE id = ?', [id]);
    if (!existing) throw notFound('Product not found');

    await tx.run(
      'INSERT INTO price_history (product_id, old_price, new_price, updated_by, updated_by_name) VALUES (?, ?, ?, ?, ?)',
      [id, existing.price, price, actor.id, actor.name]
    );
    await tx.run('UPDATE products SET price = ?, discount_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
      price,
      discount_price ?? null,
      id,
    ]);
    await audit(tx, actor, 'PRICE_CHANGE', `Explicit price update for '${existing.name}' from ₹${existing.price} to ₹${price}`, req.ip);
    return tx.all('SELECT * FROM price_history WHERE product_id = ? ORDER BY created_at DESC, id DESC', [id]);
  });

  return res.json({ message: 'Price updated successfully', newPrice: price, priceHistory: history });
});

router.patch('/:id/toggle-status', authenticateToken, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  const actor = currentUser(req);
  const { id } = parse(idParam, req.params);

  const next = await db.transaction(async (tx) => {
    const existing = await tx.get<ProductRow>('SELECT * FROM products WHERE id = ?', [id]);
    if (!existing || existing.is_archived) throw notFound('Product not found');
    const nextStatus = existing.availability === 'AVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE';
    await tx.run('UPDATE products SET availability = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [nextStatus, id]);
    await audit(tx, actor, 'TOGGLE_PRODUCT_STATUS', `Status of '${existing.name}' changed to ${nextStatus}`, req.ip);
    return nextStatus;
  });

  return res.json({ message: `Product availability changed to ${next}`, availability: next });
});

// Soft delete: order history and cart snapshots keep referencing the product row.
router.delete('/:id', authenticateToken, requireRole('ADMIN'), async (req: AuthenticatedRequest, res) => {
  const actor = currentUser(req);
  const { id } = parse(idParam, req.params);

  await db.transaction(async (tx) => {
    const existing = await tx.get<ProductRow>('SELECT * FROM products WHERE id = ?', [id]);
    if (!existing || existing.is_archived) throw notFound('Product not found');
    await tx.run(
      `UPDATE products SET is_archived = 1, availability = 'UNAVAILABLE', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [id]
    );
    await audit(tx, actor, 'DELETE_PRODUCT', `Archived product: ${existing.name}`, req.ip);
  });

  return res.json({ message: 'Product deleted successfully' });
});

export default router;
